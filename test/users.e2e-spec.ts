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
  accessToken: string;
  refreshToken: string;
  user: UserJson;
}

interface PageJson {
  data: UserJson[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ErrorJson {
  statusCode: number;
  message: string | string[];
}

describe('API de usuários (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  /** O primeiro cadastrado (ADMIN) e um usuário comum, recriados a cada teste. */
  let admin: AuthJson;
  let member: AuthJson;

  const api = () => request(app.getHttpServer());
  const bearer = (session: AuthJson) => `Bearer ${session.accessToken}`;

  async function register(email: string): Promise<AuthJson> {
    const response = await api()
      .post('/auth/register')
      .send({ email, password: 'senha-de-teste' })
      .expect(201);
    return response.body as AuthJson;
  }

  function changeRole(session: AuthJson, id: number, role: string) {
    return api().patch(`/users/${id}/role`).set('Authorization', bearer(session)).send({ role });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    admin = await register('admin@exemplo.com');
    member = await register('membro@exemplo.com');
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('acesso', () => {
    it.each([
      ['GET', '/users'],
      ['PATCH', '/users/1/role'],
    ] as const)('%s %s responde 401 sem token e 403 para quem não é ADMIN', async (method, url) => {
      const call = () =>
        method === 'GET' ? api().get(url) : api().patch(url).send({ role: 'ADMIN' });

      await call().expect(401);
      const response = await call().set('Authorization', bearer(member)).expect(403);

      expect((response.body as ErrorJson).message).toBe('Esta operação exige o papel ADMIN.');
      await expect(prisma.user.count({ where: { role: 'ADMIN' } })).resolves.toBe(1);
    });
  });

  describe('GET /users', () => {
    it('lista os usuários, paginados e sem o hash da senha', async () => {
      const response = await api()
        .get('/users?limit=1&page=2')
        .set('Authorization', bearer(admin))
        .expect(200);
      const page = response.body as PageJson;

      expect(page.meta).toEqual({ total: 2, page: 2, limit: 1, totalPages: 2 });
      expect(page.data).toEqual([member.user]);
      expect(response.text).not.toContain('scrypt');
      expect(response.text).not.toContain('passwordHash');
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('o ADMIN promove um usuário: o papel vale na hora e as sessões dele são revogadas', async () => {
      const response = await changeRole(admin, member.user.id, 'ADMIN').expect(200);

      expect(response.body).toEqual({ ...member.user, role: 'ADMIN' });
      // O token de acesso antigo (que diz USER) já passa nas rotas de ADMIN: o guard lê o banco.
      await api().get('/users').set('Authorization', bearer(member)).expect(200);
      // A sessão antiga não renova mais; entrando de novo, o token já sai com ADMIN.
      await api().post('/auth/refresh').send({ refreshToken: member.refreshToken }).expect(401);
      const login = (
        await api()
          .post('/auth/login')
          .send({ email: 'membro@exemplo.com', password: 'senha-de-teste' })
          .expect(200)
      ).body as AuthJson;
      expect(login.user.role).toBe('ADMIN');
    });

    it('o ADMIN rebaixado perde o acesso de ADMIN na hora, com o mesmo token', async () => {
      await changeRole(admin, member.user.id, 'ADMIN').expect(200);
      await api().get('/users').set('Authorization', bearer(admin)).expect(200);

      await changeRole(member, admin.user.id, 'USER').expect(200);

      const denied = await api().get('/users').set('Authorization', bearer(admin)).expect(403);
      expect((denied.body as ErrorJson).message).toBe('Esta operação exige o papel ADMIN.');
      await api().delete('/prototypes/1').set('Authorization', bearer(admin)).expect(403);
      await changeRole(admin, member.user.id, 'USER').expect(403);
      // E a sessão dele não renova mais.
      await api().post('/auth/refresh').send({ refreshToken: admin.refreshToken }).expect(401);
      // Rotas sem @Roles seguem só o token: criar protótipo continua permitido.
      await api()
        .post('/prototypes')
        .set('Authorization', bearer(admin))
        .send({ name: 'x', primitive: 1, component: '2024-06-15T12:00:00.000Z' })
        .expect(201);
      await prisma.prototype.deleteMany();
    });

    it('rota com @Roles responde 401 quando o usuário do token foi apagado', async () => {
      await prisma.user.delete({ where: { id: admin.user.id } });

      await api().get('/users').set('Authorization', bearer(admin)).expect(401);
    });

    it('rebaixa um ADMIN quando ainda resta outro', async () => {
      await changeRole(admin, member.user.id, 'ADMIN').expect(200);

      const response = await changeRole(admin, admin.user.id, 'USER').expect(200);

      expect((response.body as UserJson).role).toBe('USER');
      await expect(prisma.user.count({ where: { role: 'ADMIN' } })).resolves.toBe(1);
    });

    it('recusa (409) rebaixar o último ADMIN', async () => {
      const response = await changeRole(admin, admin.user.id, 'USER').expect(409);

      expect((response.body as ErrorJson).message).toBe(
        'Não é possível remover o papel do último ADMIN.',
      );
      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } }),
      ).resolves.toMatchObject({ role: 'ADMIN' });
    });

    it('dois ADMIN rebaixando um ao outro ao mesmo tempo: só um consegue', async () => {
      await changeRole(admin, member.user.id, 'ADMIN').expect(200);

      const results = await Promise.all([
        changeRole(admin, member.user.id, 'USER'),
        changeRole(member, admin.user.id, 'USER'),
      ]);

      // Quem chega depois recebe 409 (a transação viu um ADMIN só) ou 403 (o guard já
      // leu o papel novo no banco); em nenhum caso os dois saem rebaixados.
      const [first, second] = results.map((response) => response.status).sort();
      expect(first).toBe(200);
      expect([403, 409]).toContain(second);
      await expect(prisma.user.count({ where: { role: 'ADMIN' } })).resolves.toBe(1);
    });

    it('manter o papel atual responde 200 sem mudar nada', async () => {
      const response = await changeRole(admin, admin.user.id, 'ADMIN').expect(200);

      expect(response.body).toEqual(admin.user);
    });

    it('responde 404 para usuário inexistente', async () => {
      await changeRole(admin, member.user.id + 1000, 'ADMIN').expect(404);
    });

    it.each([
      ['papel desconhecido', { role: 'ROOT' }],
      ['sem o papel', {}],
      ['campo a mais', { role: 'ADMIN', email: 'outro@exemplo.com' }],
    ])('responde 400 para %s', async (_caso, body) => {
      await api()
        .patch(`/users/${member.user.id}/role`)
        .set('Authorization', bearer(admin))
        .send(body)
        .expect(400);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: member.user.id } }),
      ).resolves.toMatchObject({ role: 'USER', email: 'membro@exemplo.com' });
    });

    it('responde 400 para id que não é número', async () => {
      await changeRole(admin, Number.NaN, 'ADMIN').expect(400);
    });
  });
});
