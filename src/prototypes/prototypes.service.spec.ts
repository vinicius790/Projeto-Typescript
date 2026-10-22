import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PrototypeRecord } from './prototype.model';
import { PrototypesService } from './prototypes.service';

const include = { circularReference: true };

function record(overrides: Partial<PrototypeRecord> = {}): PrototypeRecord {
  return {
    id: 1,
    name: 'Original',
    primitive: 245,
    component: new Date('2024-06-15T12:00:00.000Z'),
    version: 1,
    createdAt: new Date('2024-06-01T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    clonedFromId: null,
    circularReference: { id: 10, label: 'componente A', prototypeId: 1 },
    ...overrides,
  };
}

function createPrismaMock() {
  const client = {
    prototype: {
      create: jest.fn<Promise<PrototypeRecord>, [Prisma.PrototypeCreateArgs]>(),
      findMany: jest.fn<Promise<PrototypeRecord[]>, [Prisma.PrototypeFindManyArgs]>(),
      findUnique: jest.fn<Promise<PrototypeRecord | null>, [Prisma.PrototypeFindUniqueArgs]>(),
      update: jest.fn<Promise<PrototypeRecord>, [Prisma.PrototypeUpdateArgs]>(),
      updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Prisma.PrototypeUpdateManyArgs]>(),
      delete: jest.fn<Promise<PrototypeRecord>, [Prisma.PrototypeDeleteArgs]>(),
      count: jest.fn<Promise<number>, []>(),
    },
    prototypeRevision: {
      create: jest.fn<
        Promise<Prisma.PrototypeRevisionGetPayload<object>>,
        [Prisma.PrototypeRevisionCreateArgs]
      >(),
      findMany: jest.fn<
        Promise<Prisma.PrototypeRevisionGetPayload<object>[]>,
        [Prisma.PrototypeRevisionFindManyArgs]
      >(),
      findUnique: jest.fn<
        Promise<Prisma.PrototypeRevisionGetPayload<object> | null>,
        [Prisma.PrototypeRevisionFindUniqueArgs]
      >(),
    },
    circularReference: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return {
    ...client,
    $transaction: jest.fn(
      (
        operation:
          | ((tx: Prisma.TransactionClient) => Promise<unknown>)
          | Promise<unknown>[],
      ) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : operation(client as unknown as Prisma.TransactionClient),
    ),
  };
}

describe('PrototypesService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PrototypesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.prototype.updateMany.mockResolvedValue({ count: 1 });
    prisma.prototypeRevision.create.mockResolvedValue({
      id: 1,
      prototypeId: 1,
      version: 1,
      name: 'Original',
      primitive: 245,
      component: new Date('2024-06-15T12:00:00.000Z'),
      circularReferenceLabel: 'componente A',
      actorId: 7,
      recordedAt: new Date('2024-06-01T00:00:00.000Z'),
    });
    prisma.circularReference.upsert.mockResolvedValue({
      id: 10,
      label: 'componente A',
      prototypeId: 1,
    });
    service = new PrototypesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('converte a data ISO e cria o componente circular junto com o protótipo', async () => {
      prisma.prototype.create.mockResolvedValue(record());

      await service.create({
        name: 'Original',
        primitive: 245,
        component: '2024-06-15T12:00:00.000Z',
        circularReference: { label: 'componente A' },
      }, 7);

      expect(prisma.prototype.create).toHaveBeenCalledWith({
        data: {
          name: 'Original',
          primitive: 245,
          component: new Date('2024-06-15T12:00:00.000Z'),
          circularReference: { create: { label: 'componente A' } },
        },
        include,
      });
      expect(prisma.prototypeRevision.create).toHaveBeenCalledWith({
        data: {
          prototype: { connect: { id: 1 } },
          actor: { connect: { id: 7 } },
          version: 1,
          name: 'Original',
          primitive: 245,
          component: new Date('2024-06-15T12:00:00.000Z'),
          circularReferenceLabel: 'componente A',
        },
      });
    });

    it('não cria componente circular quando ele não é informado', async () => {
      prisma.prototype.create.mockResolvedValue(record({ circularReference: null }));

      await service.create({ name: 'Simples', primitive: 1, component: '2024-01-01' }, 7);

      expect(prisma.prototype.create.mock.calls[0]?.[0].data.circularReference).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('calcula skip/take a partir da página e devolve os metadados', async () => {
      prisma.prototype.findMany.mockResolvedValue([record({ id: 11 }), record({ id: 12 })]);
      prisma.prototype.count.mockResolvedValue(12);

      const result = await service.findAll({ page: 3, limit: 5 });

      expect(prisma.prototype.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 5,
        orderBy: { id: 'asc' },
        include,
      });
      expect(result.data.map((item) => item.id)).toEqual([11, 12]);
      expect(result.meta).toEqual({ total: 12, page: 3, limit: 5, totalPages: 3 });
    });

    it('devolve zero páginas quando não há registros', async () => {
      prisma.prototype.findMany.mockResolvedValue([]);
      prisma.prototype.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    });
  });

  describe('findOne', () => {
    it('devolve o protótipo com o componente circular', async () => {
      prisma.prototype.findUnique.mockResolvedValue(record());

      await expect(service.findOne(1)).resolves.toEqual(record());
      expect(prisma.prototype.findUnique).toHaveBeenCalledWith({ where: { id: 1 }, include });
    });

    it('lança NotFoundException quando o id não existe', async () => {
      prisma.prototype.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(99)).rejects.toThrow('Protótipo 99 não encontrado.');
    });
  });

  describe('update', () => {
    it('envia só os campos informados', async () => {
      prisma.prototype.findUnique
        .mockResolvedValueOnce(record())
        .mockResolvedValueOnce(record({ name: 'Novo nome', version: 2 }));

      await service.update(1, { name: 'Novo nome', expectedVersion: 1 }, 7);

      expect(prisma.prototype.updateMany.mock.calls[0]?.[0]).toStrictEqual({
        where: { id: 1, version: 1 },
        data: {
          name: 'Novo nome',
          primitive: undefined,
          component: undefined,
          version: { increment: 1 },
        },
      });
      expect(prisma.prototypeRevision.create).toHaveBeenCalled();
    });

    it('converte a data e cria ou atualiza o componente circular', async () => {
      prisma.prototype.findUnique
        .mockResolvedValueOnce(record())
        .mockResolvedValueOnce(record({ version: 2 }));

      await service.update(1, {
        component: '2025-01-01T00:00:00.000Z',
        circularReference: { label: 'novo rótulo' },
      }, 7);

      expect(prisma.prototype.updateMany.mock.calls[0]?.[0].data).toMatchObject({
        component: new Date('2025-01-01T00:00:00.000Z'),
        version: { increment: 1 },
      });
      expect(prisma.circularReference.upsert).toHaveBeenCalledWith({
        where: { prototypeId: 1 },
        create: { prototypeId: 1, label: 'novo rótulo' },
        update: { label: 'novo rótulo' },
      });
    });
  });

  describe('remove', () => {
    it('apaga pelo id', async () => {
      prisma.prototype.delete.mockResolvedValue(record());

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(prisma.prototype.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('clone', () => {
    it('grava o clone com um componente circular PRÓPRIO, ligado ao clone e não ao original', async () => {
      const source = record();
      prisma.prototype.findUnique.mockResolvedValue(source);
      prisma.prototype.create.mockResolvedValue(record({ id: 2, clonedFromId: 1 }));

      await service.clone(1, {}, 7);

      // Regressão: a versão antiga fazia `circularReference.create.prototype.connect`
      // com o id do ORIGINAL, prendendo o novo componente ao protótipo errado.
      expect(prisma.prototype.create.mock.calls[0]?.[0]).toStrictEqual({
        data: {
          name: 'Original (cópia)',
          primitive: 245,
          component: new Date('2024-06-15T12:00:00.000Z'),
          circularReference: { create: { label: 'componente A' } },
          clonedFrom: { connect: { id: 1 } },
        },
        include,
      });
      expect(prisma.prototypeRevision.create).toHaveBeenCalled();
    });

    it('entrega ao banco uma cópia da data, não o objeto do registro original', async () => {
      const source = record();
      prisma.prototype.findUnique.mockResolvedValue(source);
      prisma.prototype.create.mockResolvedValue(record({ id: 2 }));

      await service.clone(1, {}, 7);

      expect(prisma.prototype.create.mock.calls[0]?.[0].data.component).not.toBe(source.component);
    });

    it('não cria componente circular quando o original não tem', async () => {
      prisma.prototype.findUnique.mockResolvedValue(record({ circularReference: null }));
      prisma.prototype.create.mockResolvedValue(record({ id: 2, circularReference: null }));

      await service.clone(1, {}, 7);

      expect(prisma.prototype.create.mock.calls[0]?.[0].data.circularReference).toBeUndefined();
    });

    it('usa o nome informado no lugar do nome padrão', async () => {
      prisma.prototype.findUnique.mockResolvedValue(record());
      prisma.prototype.create.mockResolvedValue(record({ id: 2 }));

      await service.clone(1, { name: 'Versão 2' }, 7);

      expect(prisma.prototype.create.mock.calls[0]?.[0].data.name).toBe('Versão 2');
    });

    it('lança NotFoundException e não grava nada quando o original não existe', async () => {
      prisma.prototype.findUnique.mockResolvedValue(null);

      await expect(service.clone(99, {}, 7)).rejects.toThrow(NotFoundException);
      expect(prisma.prototype.create).not.toHaveBeenCalled();
    });
  });

  describe('modelos do catálogo', () => {
    it('lista os modelos disponíveis', () => {
      expect(service.listTemplates()).toEqual([
        {
          key: 'basico',
          name: 'Protótipo básico',
          primitive: 0,
          component: new Date('2024-01-01T00:00:00.000Z'),
          circularReferenceLabel: null,
        },
        {
          key: 'com-referencia',
          name: 'Protótipo com referência circular',
          primitive: 245,
          component: new Date('2024-06-15T12:00:00.000Z'),
          circularReferenceLabel: 'componente padrão',
        },
      ]);
    });

    it('cria um registro a partir de um modelo, aceitando outro nome', async () => {
      prisma.prototype.create.mockResolvedValue(record());

      await service.createFromTemplate('com-referencia', { name: 'Meu protótipo' }, 7);

      expect(prisma.prototype.create.mock.calls[0]?.[0]).toStrictEqual({
        data: {
          name: 'Meu protótipo',
          primitive: 245,
          component: new Date('2024-06-15T12:00:00.000Z'),
          circularReference: { create: { label: 'componente padrão' } },
        },
        include,
      });
    });

    it('não altera o catálogo ao personalizar um registro criado a partir dele', async () => {
      prisma.prototype.create.mockResolvedValue(record());

      await service.createFromTemplate('basico', { name: 'Personalizado' }, 7);

      expect(service.listTemplates()[0]?.name).toBe('Protótipo básico');
    });

    it('lança NotFoundException para um modelo desconhecido', () => {
      expect(() => service.createFromTemplate('inexistente', {}, 7)).toThrow(NotFoundException);
      expect(prisma.prototype.create).not.toHaveBeenCalled();
    });
  });
});
