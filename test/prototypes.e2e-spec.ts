import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupSwagger } from '../src/swagger';

interface PrototypeJson {
  id: number;
  name: string;
  primitive: number;
  component: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  clonedFromId: number | null;
  circularReference: { id: number; label: string; prototypeId: number } | null;
}

interface PageJson {
  data: PrototypeJson[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface RevisionJson {
  id: number;
  prototypeId: number;
  version: number;
  name: string;
  primitive: number;
  component: string;
  circularReferenceLabel: string | null;
  recordedAt: string;
}

interface TokensJson {
  accessToken: string;
  refreshToken: string;
}

interface ErrorJson {
  statusCode: number;
  message: string | string[];
}

const validPayload = {
  name: 'Relatório mensal',
  primitive: 245,
  component: '2024-06-15T12:00:00.000Z',
  circularReference: { label: 'componente A' },
};

describe('API de protótipos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => `Bearer ${token}`;

  /** Requisições de escrita, já com o token de acesso (por padrão, o do usuário comum). */
  const write = (token: string = userToken) => ({
    post: (url: string) => api().post(url).set('Authorization', bearer(token)),
    patch: (url: string) => api().patch(url).set('Authorization', bearer(token)),
    delete: (url: string) => api().delete(url).set('Authorization', bearer(token)),
  });

  async function registerUser(email: string): Promise<TokensJson> {
    const response = await api()
      .post('/auth/register')
      .send({ email, password: 'senha-de-teste' })
      .expect(201);
    return response.body as TokensJson;
  }

  async function createPrototype(payload: object = validPayload): Promise<PrototypeJson> {
    const response = await write().post('/prototypes').send(payload).expect(201);
    return response.body as PrototypeJson;
  }

  async function getPrototype(id: number): Promise<PrototypeJson> {
    const response = await api().get(`/prototypes/${id}`).expect(200);
    return response.body as PrototypeJson;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
    prisma = app.get(PrismaService);

    // O primeiro usuário cadastrado vira ADMIN; o segundo é um usuário comum.
    await prisma.user.deleteMany();
    adminToken = (await registerUser('admin@exemplo.com')).accessToken;
    userToken = (await registerUser('usuario@exemplo.com')).accessToken;
  });

  beforeEach(async () => {
    await prisma.prototype.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autenticação e papéis nas rotas de escrita', () => {
    it.each([
      ['POST', '/prototypes'],
      ['POST', '/prototypes/from-template/basico'],
      ['PATCH', '/prototypes/1'],
      ['DELETE', '/prototypes/1'],
      ['POST', '/prototypes/1/clone'],
      ['POST', '/prototypes/1/revisions/1/restore'],
    ] as const)('%s %s responde 401 sem token', async (method, url) => {
      const anonymous = {
        POST: () => api().post(url),
        PATCH: () => api().patch(url),
        DELETE: () => api().delete(url),
      };

      const response = await anonymous[method]().send(validPayload).expect(401);

      expect((response.body as ErrorJson).statusCode).toBe(401);
      await expect(prisma.prototype.count()).resolves.toBe(0);
    });

    it.each([
      ['token que não é um JWT', 'Bearer abc'],
      ['esquema diferente de Bearer', 'Basic YTpi'],
      ['token com a assinatura adulterada', 'adulterado'],
    ])('responde 401 para %s', async (_caso, header) => {
      const authorization = header === 'adulterado' ? `${bearer(userToken)}x` : header;

      await api()
        .post('/prototypes')
        .set('Authorization', authorization)
        .send(validPayload)
        .expect(401);

      await expect(prisma.prototype.count()).resolves.toBe(0);
    });

    it('não aceita um token de renovação no lugar do token de acesso', async () => {
      const { refreshToken } = await registerUser('renovacao@exemplo.com');

      await write(refreshToken).post('/prototypes').send(validPayload).expect(401);
    });

    it('a leitura continua pública', async () => {
      const created = await createPrototype();

      await api().get('/prototypes').expect(200);
      await api().get('/prototypes/templates').expect(200);
      await api().get(`/prototypes/${created.id}`).expect(200);
    });

    it('DELETE responde 403 para quem não é ADMIN e não apaga nada', async () => {
      const created = await createPrototype();

      const response = await write(userToken).delete(`/prototypes/${created.id}`).expect(403);

      expect((response.body as ErrorJson).message).toBe('Esta operação exige o papel ADMIN.');
      await expect(getPrototype(created.id)).resolves.toEqual(created);
    });

    it('o ADMIN também pode criar e alterar', async () => {
      const response = await write(adminToken).post('/prototypes').send(validPayload).expect(201);
      const created = response.body as PrototypeJson;

      await write(adminToken).patch(`/prototypes/${created.id}`).send({ name: 'x' }).expect(200);
    });

    it('confere o token antes de validar o corpo', async () => {
      await api().post('/prototypes').send({}).expect(401);
    });
  });

  describe('POST /prototypes', () => {
    it('cria um protótipo com o componente circular ligado a ele', async () => {
      const created = await createPrototype();

      expect(created).toMatchObject({
        name: 'Relatório mensal',
        primitive: 245,
        component: '2024-06-15T12:00:00.000Z',
        clonedFromId: null,
        circularReference: { label: 'componente A', prototypeId: created.id },
      });
      expect(Number.isInteger(created.id)).toBe(true);
    });

    it('cria um protótipo sem componente circular', async () => {
      const created = await createPrototype({
        name: 'Simples',
        primitive: -1,
        component: '2024-01-01',
      });

      expect(created.circularReference).toBeNull();
      expect(created.component).toBe('2024-01-01T00:00:00.000Z');
    });

    it.each([
      ['corpo vazio', {}],
      ['primitive não inteiro', { ...validPayload, primitive: 1.5 }],
      ['primitive em texto', { ...validPayload, primitive: '245' }],
      ['primitive fora de 32 bits', { ...validPayload, primitive: 2 ** 31 }],
      ['data inválida', { ...validPayload, component: '2024-02-30' }],
      ['data que não é texto', { ...validPayload, component: 1718452800000 }],
      ['nome vazio', { ...validPayload, name: '' }],
      ['nome longo demais', { ...validPayload, name: 'x'.repeat(101) }],
      ['campo desconhecido', { ...validPayload, admin: true }],
      ['expectedVersion com tipo incorreto', { ...validPayload, expectedVersion: '1' }],
      ['componente circular sem rótulo', { ...validPayload, circularReference: {} }],
      [
        'campo desconhecido no componente circular',
        { ...validPayload, circularReference: { label: 'a', prototypeId: 1 } },
      ],
    ])('responde 400 para %s', async (_caso, payload) => {
      const response = await write().post('/prototypes').send(payload).expect(400);

      expect((response.body as ErrorJson).statusCode).toBe(400);
      await expect(prisma.prototype.count()).resolves.toBe(0);
    });
  });

  describe('GET /prototypes', () => {
    it('devolve lista vazia quando não há registros', async () => {
      const response = await api().get('/prototypes').expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
    });

    it('pagina os resultados em ordem de id', async () => {
      const first = await createPrototype({ ...validPayload, name: 'A' });
      const second = await createPrototype({ ...validPayload, name: 'B' });
      const third = await createPrototype({ ...validPayload, name: 'C' });

      const pageOne = (await api().get('/prototypes?page=1&limit=2').expect(200)).body as PageJson;
      const pageTwo = (await api().get('/prototypes?page=2&limit=2').expect(200)).body as PageJson;
      const pageThree = (await api().get('/prototypes?page=3&limit=2').expect(200))
        .body as PageJson;

      expect(pageOne.data.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(pageOne.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2 });
      expect(pageTwo.data.map((item) => item.id)).toEqual([third.id]);
      expect(pageTwo.data[0]?.circularReference?.label).toBe('componente A');
      expect(pageThree.data).toEqual([]);
    });

    it.each(['page=0', 'page=abc', 'limit=0', 'limit=101', 'limit=1.5', 'page=1000001', 'x=1'])(
      'responde 400 para a consulta inválida ?%s',
      async (query) => {
        await api().get(`/prototypes?${query}`).expect(400);
      },
    );
  });

  describe('GET /prototypes/:id', () => {
    it('devolve o protótipo', async () => {
      const created = await createPrototype();

      await expect(getPrototype(created.id)).resolves.toEqual(created);
    });

    it('responde 404 para um id que não existe', async () => {
      const response = await api().get('/prototypes/999999').expect(404);

      expect((response.body as ErrorJson).message).toBe('Protótipo 999999 não encontrado.');
    });

    it('responde 400 para um id que não é número', async () => {
      await api().get('/prototypes/abc').expect(400);
    });
  });

  describe('PATCH /prototypes/:id', () => {
    it('altera só os campos enviados', async () => {
      const created = await createPrototype();

      const response = await write()
        .patch(`/prototypes/${created.id}`)
        .send({ name: 'Novo nome', primitive: 7 })
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.id,
        name: 'Novo nome',
        primitive: 7,
        component: created.component,
        circularReference: created.circularReference,
      });
    });

    it('atualiza o rótulo do componente circular existente sem criar outro', async () => {
      const created = await createPrototype();

      const response = await write()
        .patch(`/prototypes/${created.id}`)
        .send({ circularReference: { label: 'novo rótulo' } })
        .expect(200);

      expect((response.body as PrototypeJson).circularReference).toEqual({
        id: created.circularReference?.id,
        label: 'novo rótulo',
        prototypeId: created.id,
      });
      await expect(prisma.circularReference.count()).resolves.toBe(1);
    });

    it('cria o componente circular quando o protótipo ainda não tem um', async () => {
      const created = await createPrototype({ name: 'Simples', primitive: 1, component: '2024' });

      const response = await write()
        .patch(`/prototypes/${created.id}`)
        .send({ circularReference: { label: 'recém-criado' } })
        .expect(200);

      expect((response.body as PrototypeJson).circularReference).toMatchObject({
        label: 'recém-criado',
        prototypeId: created.id,
      });
    });

    it.each([
      ['campo nulo', { name: null }],
      ['tipo errado', { primitive: 'dez' }],
      ['campo desconhecido', { id: 5 }],
    ])('responde 400 para %s', async (_caso, payload) => {
      const created = await createPrototype();

      await write().patch(`/prototypes/${created.id}`).send(payload).expect(400);

      await expect(getPrototype(created.id)).resolves.toEqual(created);
    });

    it('responde 404 para um id que não existe', async () => {
      const response = await write().patch('/prototypes/999999').send({ name: 'x' }).expect(404);

      expect((response.body as ErrorJson).message).toBe('Registro não encontrado.');
    });
  });

  describe('histórico e restauração de versões', () => {
    it('grava o snapshot inicial e registra cada atualização com versão crescente', async () => {
      const created = await createPrototype();
      expect(created.version).toBe(1);

      await write()
        .patch(`/prototypes/${created.id}`)
        .send({ name: 'Relatório revisado', expectedVersion: 1 })
        .expect(200)
        .expect(({ body }) => expect(body.version).toBe(2));

      const response = await api().get(`/prototypes/${created.id}/revisions`).expect(200);
      const revisions = response.body as RevisionJson[];
      expect(revisions.map(({ version }) => version)).toEqual([1, 2]);
      expect(revisions[0]).toMatchObject({
        prototypeId: created.id,
        name: created.name,
        primitive: created.primitive,
        circularReferenceLabel: 'componente A',
      });
      expect(revisions[1]?.name).toBe('Relatório revisado');
      expect(revisions[0]).not.toHaveProperty('actorId');
    });

    it('recusa uma edição com versão desatualizada sem alterar o estado atual', async () => {
      const created = await createPrototype();
      await write()
        .patch(`/prototypes/${created.id}`)
        .send({ name: 'Versão nova', expectedVersion: 1 })
        .expect(200);

      const conflict = await write()
        .patch(`/prototypes/${created.id}`)
        .send({ name: 'Edição obsoleta', expectedVersion: 1 })
        .expect(409);

      expect(conflict.body).toMatchObject({ statusCode: 409 });
      await expect(getPrototype(created.id)).resolves.toMatchObject({
        name: 'Versão nova',
        version: 2,
      });
      await expect(prisma.prototypeRevision.count({ where: { prototypeId: created.id } })).resolves.toBe(2);
    });

    it('restaura também os componentes opcionais e registra a restauração como nova versão', async () => {
      const created = await createPrototype();
      await write()
        .patch(`/prototypes/${created.id}`)
        .send({
          name: 'Rascunho alterado',
          component: '2025-01-01T00:00:00.000Z',
          circularReference: { label: 'rótulo alterado' },
          expectedVersion: 1,
        })
        .expect(200);

      const restored = await write()
        .post(`/prototypes/${created.id}/revisions/1/restore`)
        .expect(200);

      expect(restored.body).toMatchObject({
        id: created.id,
        name: created.name,
        primitive: created.primitive,
        component: created.component,
        version: 3,
        circularReference: { label: 'componente A', prototypeId: created.id },
      });
      await expect(prisma.prototypeRevision.count({ where: { prototypeId: created.id } })).resolves.toBe(3);
      await expect(
        prisma.prototypeRevision.findUnique({
          where: { prototypeId_version: { prototypeId: created.id, version: 3 } },
        }),
      ).resolves.toMatchObject({ name: created.name, circularReferenceLabel: 'componente A' });
    });

    it('responde 404 para protótipo ou versão ausente', async () => {
      const created = await createPrototype();

      await api().get('/prototypes/999999/revisions').expect(404);
      await write().post(`/prototypes/${created.id}/revisions/99/restore`).expect(404);
    });
  });

  describe('DELETE /prototypes/:id', () => {
    it('remove o protótipo e o seu componente circular', async () => {
      const created = await createPrototype();

      await write(adminToken).delete(`/prototypes/${created.id}`).expect(204);

      await api().get(`/prototypes/${created.id}`).expect(404);
      await expect(prisma.circularReference.count()).resolves.toBe(0);
    });

    it('mantém os clones quando o original é removido', async () => {
      const original = await createPrototype();
      const clone = (await write().post(`/prototypes/${original.id}/clone`).expect(201))
        .body as PrototypeJson;

      await write(adminToken).delete(`/prototypes/${original.id}`).expect(204);

      const survivor = await getPrototype(clone.id);
      expect(survivor.clonedFromId).toBeNull();
      expect(survivor.circularReference).toEqual(clone.circularReference);
    });

    it('responde 404 para um id que não existe', async () => {
      await write(adminToken).delete('/prototypes/999999').expect(404);
    });
  });

  describe('POST /prototypes/:id/clone', () => {
    it('cria um novo registro igual ao original, com componente circular próprio', async () => {
      const original = await createPrototype();

      const response = await write().post(`/prototypes/${original.id}/clone`).expect(201);
      const clone = response.body as PrototypeJson;

      expect(clone.id).not.toBe(original.id);
      expect(clone).toMatchObject({
        name: 'Relatório mensal (cópia)',
        primitive: original.primitive,
        component: original.component,
        clonedFromId: original.id,
      });
      // Regressão: o componente circular do clone tem de pertencer ao CLONE.
      expect(clone.circularReference).toMatchObject({
        label: 'componente A',
        prototypeId: clone.id,
      });
      expect(clone.circularReference?.id).not.toBe(original.circularReference?.id);
    });

    it('não altera o registro original', async () => {
      const original = await createPrototype();

      await write().post(`/prototypes/${original.id}/clone`).send({ name: 'Outro' }).expect(201);

      await expect(getPrototype(original.id)).resolves.toEqual(original);
      await expect(prisma.prototype.count()).resolves.toBe(2);
      await expect(prisma.circularReference.count()).resolves.toBe(2);
    });

    it('aceita um nome para o clone', async () => {
      const original = await createPrototype();

      const response = await write()
        .post(`/prototypes/${original.id}/clone`)
        .send({ name: 'Versão 2' })
        .expect(201);

      expect((response.body as PrototypeJson).name).toBe('Versão 2');
    });

    it('clona um protótipo sem componente circular', async () => {
      const original = await createPrototype({ name: 'Simples', primitive: 1, component: '2024' });

      const response = await write().post(`/prototypes/${original.id}/clone`).expect(201);

      expect((response.body as PrototypeJson).circularReference).toBeNull();
    });

    it('permite clonar um clone, registrando a origem imediata', async () => {
      const original = await createPrototype();
      const first = (await write().post(`/prototypes/${original.id}/clone`).expect(201))
        .body as PrototypeJson;

      const second = (await write().post(`/prototypes/${first.id}/clone`).expect(201))
        .body as PrototypeJson;

      expect(second.clonedFromId).toBe(first.id);
      expect(second.name).toBe('Relatório mensal (cópia) (cópia)');
    });

    it('responde 400 para um nome inválido', async () => {
      const original = await createPrototype();

      await write().post(`/prototypes/${original.id}/clone`).send({ name: '' }).expect(400);
    });

    it('responde 404 quando o original não existe', async () => {
      await write().post('/prototypes/999999/clone').expect(404);

      await expect(prisma.prototype.count()).resolves.toBe(0);
    });
  });

  describe('modelos do catálogo', () => {
    it('GET /prototypes/templates lista os modelos', async () => {
      const response = await api().get('/prototypes/templates').expect(200);

      expect(response.body).toEqual([
        {
          key: 'basico',
          name: 'Protótipo básico',
          primitive: 0,
          component: '2024-01-01T00:00:00.000Z',
          circularReferenceLabel: null,
        },
        {
          key: 'com-referencia',
          name: 'Protótipo com referência circular',
          primitive: 245,
          component: '2024-06-15T12:00:00.000Z',
          circularReferenceLabel: 'componente padrão',
        },
      ]);
    });

    it('POST /prototypes/from-template/:key cria um registro a partir do modelo', async () => {
      const response = await write()
        .post('/prototypes/from-template/com-referencia')
        .send({ name: 'Meu protótipo' })
        .expect(201);
      const created = response.body as PrototypeJson;

      expect(created).toMatchObject({
        name: 'Meu protótipo',
        primitive: 245,
        component: '2024-06-15T12:00:00.000Z',
        clonedFromId: null,
        circularReference: { label: 'componente padrão', prototypeId: created.id },
      });
    });

    it('responde 404 para um modelo desconhecido', async () => {
      const response = await write().post('/prototypes/from-template/inexistente').expect(404);

      expect((response.body as ErrorJson).message).toBe('Modelo "inexistente" não encontrado.');
    });
  });

  describe('documentação', () => {
    it('GET /docs-json publica o documento OpenAPI com as rotas da API', async () => {
      const response = await api().get('/docs-json').expect(200);
      const document = response.body as { openapi: string; paths: Record<string, object> };

      expect(document.openapi).toMatch(/^3\./);
      expect(Object.keys(document.paths).sort()).toEqual([
        '/auth/login',
        '/auth/logout',
        '/auth/me',
        '/auth/refresh',
        '/auth/register',
        '/prototypes',
        '/prototypes/from-template/{key}',
        '/prototypes/templates',
        '/prototypes/{id}',
        '/prototypes/{id}/clone',
        '/prototypes/{id}/revisions',
        '/prototypes/{id}/revisions/{version}/restore',
        '/users',
        '/users/{id}/role',
      ]);
    });
  });
});
