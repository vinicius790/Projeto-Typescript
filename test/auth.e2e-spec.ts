import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface UserJson {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

interface AuthJson {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: UserJson;
}

interface ErrorJson {
  statusCode: number;
  message: string | string[];
}

const credentials = { email: 'ana@exemplo.com', password: 'senha-de-teste' };

describe('API de autenticação (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());

  async function register(payload: object = credentials): Promise<AuthJson> {
    const response = await api().post('/auth/register').send(payload).expect(201);
    return response.body as AuthJson;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.loginAttempt.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('cadastra o usuário e devolve os tokens, sem expor a senha', async () => {
      const response = await api().post('/auth/register').send(credentials).expect(201);
      const body = response.body as AuthJson;

      expect(body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { email: 'ana@exemplo.com', role: 'ADMIN' },
      });
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.refreshToken.split('.')).toHaveLength(3);
      expect(response.text).not.toContain('password');
      expect(response.text).not.toContain('scrypt');
    });

    it('grava a senha como hash e o e-mail em minúsculas', async () => {
      await register({ email: 'Ana@Exemplo.COM', password: credentials.password });

      const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@exemplo.com' } });
      expect(stored.passwordHash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
      expect(stored.passwordHash).not.toContain(credentials.password);
    });

    it('com cadastros simultâneos no banco vazio, exatamente um vira ADMIN', async () => {
      const emails = Array.from({ length: 8 }, (_, index) => `pessoa${index}@exemplo.com`);

      const responses = await Promise.all(
        emails.map((email) =>
          api().post('/auth/register').send({ email, password: 'senha-longa-1' }),
        ),
      );

      expect(responses.map((response) => response.status)).toEqual(emails.map(() => 201));
      const roles = responses.map((response) => (response.body as AuthJson).user.role);
      expect(roles.filter((role) => role === 'ADMIN')).toHaveLength(1);
      await expect(prisma.user.count({ where: { role: 'ADMIN' } })).resolves.toBe(1);
      await expect(prisma.user.count()).resolves.toBe(emails.length);
    });

    it('torna ADMIN só o primeiro usuário', async () => {
      const first = await register();
      const second = await register({ email: 'bia@exemplo.com', password: 'outra-senha-longa' });

      expect(first.user.role).toBe('ADMIN');
      expect(second.user.role).toBe('USER');
    });

    it('responde 409 para e-mail já cadastrado, mesmo com outra caixa', async () => {
      await register();

      const response = await api()
        .post('/auth/register')
        .send({ email: 'ANA@exemplo.com', password: 'outra-senha-longa' })
        .expect(409);

      expect((response.body as ErrorJson).message).toBe('E-mail já cadastrado.');
      await expect(prisma.user.count()).resolves.toBe(1);
    });

    it.each([
      ['corpo vazio', {}],
      ['e-mail inválido', { ...credentials, email: 'sem-arroba' }],
      ['senha curta', { ...credentials, password: '1234567' }],
      ['senha longa demais', { ...credentials, password: 'x'.repeat(129) }],
      ['senha que não é texto', { ...credentials, password: 12345678 }],
      ['tentativa de escolher o papel', { ...credentials, role: 'ADMIN' }],
    ])('responde 400 para %s', async (_caso, payload) => {
      await api().post('/auth/register').send(payload).expect(400);

      await expect(prisma.user.count()).resolves.toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('devolve os tokens para as credenciais corretas', async () => {
      const registered = await register();

      const response = await api().post('/auth/login').send(credentials).expect(200);
      const body = response.body as AuthJson;

      expect(body.user).toEqual(registered.user);
      await api().get('/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    });

    it('aceita o e-mail com outra caixa', async () => {
      await register();

      await api()
        .post('/auth/login')
        .send({ ...credentials, email: 'ANA@EXEMPLO.COM' })
        .expect(200);
    });

    it('responde 401, com a mesma mensagem, para senha errada e para e-mail inexistente', async () => {
      await register();

      const wrongPassword = await api()
        .post('/auth/login')
        .send({ ...credentials, password: 'senha-errada' })
        .expect(401);
      const unknownEmail = await api()
        .post('/auth/login')
        .send({ ...credentials, email: 'ninguem@exemplo.com' })
        .expect(401);

      expect((wrongPassword.body as ErrorJson).message).toBe('E-mail ou senha inválidos.');
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('responde 400 para corpo inválido', async () => {
      await api().post('/auth/login').send({ email: 'ana@exemplo.com' }).expect(400);
    });

    it('responde 429 com Retry-After depois de 5 tentativas do mesmo IP para o mesmo e-mail', async () => {
      const target = { email: 'limite@exemplo.com', password: 'senha-de-teste' };
      await register(target);
      for (let attempt = 0; attempt < 5; attempt++) {
        await api()
          .post('/auth/login')
          .send({ ...target, password: 'senha-errada' })
          .expect(401);
      }

      // Bloqueado mesmo com a senha certa (e o e-mail em outra caixa).
      const blocked = await api()
        .post('/auth/login')
        .send({ ...target, email: 'LIMITE@exemplo.com' })
        .expect(429);

      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect((blocked.body as ErrorJson).message).toMatch(/^Muitas tentativas de login/);
      // Outro e-mail, do mesmo IP, segue livre.
      await register();
      await api().post('/auth/login').send(credentials).expect(200);
    });

    describe('com duas instâncias da API sobre o mesmo banco', () => {
      let other: INestApplication<App>;

      beforeEach(async () => {
        const otherRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        other = otherRef.createNestApplication();
        await other.init();
      });

      afterEach(async () => {
        await other.close();
      });

      const target = { email: 'duas@exemplo.com', password: 'senha-de-teste' };
      const wrong = { ...target, password: 'senha-errada' };
      const login = (instance: INestApplication<App>, body: object) =>
        request(instance.getHttpServer()).post('/auth/login').send(body);

      it('as tentativas feitas em uma contam na outra', async () => {
        await register(target);
        for (let attempt = 0; attempt < 5; attempt++) {
          await login(attempt % 2 === 0 ? app : other, wrong).expect(401);
        }

        await login(other, target).expect(429);
        await login(app, target).expect(429);
      });

      it('tentativas simultâneas nas duas não passam do limite', async () => {
        await register(target);

        const responses = await Promise.all(
          Array.from({ length: 8 }, (_, index) => login(index % 2 === 0 ? app : other, wrong)),
        );

        const statuses = responses.map((response) => response.status).sort();
        expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429, 429]);
      });

      it('um login certo em uma zera a contagem nas duas', async () => {
        await register(target);
        for (let attempt = 0; attempt < 4; attempt++) {
          await login(app, wrong).expect(401);
        }

        await login(other, target).expect(200);

        await expect(prisma.loginAttempt.count()).resolves.toBe(0);
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('troca o token de renovação por um novo par válido', async () => {
      const { refreshToken, user } = await register();

      const response = await api().post('/auth/refresh').send({ refreshToken }).expect(200);
      const body = response.body as AuthJson;

      expect(body.user).toEqual(user);
      await api().get('/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    });

    it('o token usado deixa de valer; reapresentá-lo encerra a sessão inteira', async () => {
      const { refreshToken } = await register();
      const rotated = (await api().post('/auth/refresh').send({ refreshToken }).expect(200))
        .body as AuthJson;

      expect(rotated.refreshToken).not.toBe(refreshToken);
      await api().post('/auth/refresh').send({ refreshToken }).expect(401);
      // O reuso revogou também o token novo, que estava na mesma sessão.
      await api().post('/auth/refresh').send({ refreshToken: rotated.refreshToken }).expect(401);
    });

    it('responde 401 para um token de acesso usado como token de renovação', async () => {
      const { accessToken } = await register();

      await api().post('/auth/refresh').send({ refreshToken: accessToken }).expect(401);
    });

    it('responde 401 para token adulterado', async () => {
      const { refreshToken } = await register();

      await api()
        .post('/auth/refresh')
        .send({ refreshToken: `${refreshToken}x` })
        .expect(401);
    });

    it('responde 401 quando o usuário foi removido depois da emissão do token', async () => {
      const { refreshToken } = await register();
      await prisma.user.deleteMany();

      await api().post('/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('responde 400 sem o token', async () => {
      await api().post('/auth/refresh').send({}).expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoga a sessão: o token de renovação não serve mais', async () => {
      const { refreshToken } = await register();

      await api().post('/auth/logout').send({ refreshToken }).expect(204);

      await api().post('/auth/refresh').send({ refreshToken }).expect(401);
      await expect(prisma.refreshToken.count({ where: { revokedAt: null } })).resolves.toBe(0);
    });

    it('pode ser repetido e não derruba as outras sessões do usuário', async () => {
      const first = await register();
      const second = (await api().post('/auth/login').send(credentials).expect(200))
        .body as AuthJson;

      await api().post('/auth/logout').send({ refreshToken: first.refreshToken }).expect(204);
      await api().post('/auth/logout').send({ refreshToken: first.refreshToken }).expect(204);

      await api().post('/auth/refresh').send({ refreshToken: second.refreshToken }).expect(200);
    });

    it('responde 401 para token inválido e 400 sem o token', async () => {
      await api().post('/auth/logout').send({ refreshToken: 'abc' }).expect(401);
      await api().post('/auth/logout').send({}).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('devolve o usuário do token de acesso', async () => {
      const { accessToken, user } = await register();

      const response = await api()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({ id: user.id, email: user.email, role: user.role });
    });

    it('responde 401 sem token', async () => {
      await api().get('/auth/me').expect(401);
    });

    it('responde 401 para um token de renovação', async () => {
      const { refreshToken } = await register();

      await api().get('/auth/me').set('Authorization', `Bearer ${refreshToken}`).expect(401);
    });
  });
});
