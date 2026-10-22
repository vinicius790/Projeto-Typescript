import { PrismaService } from '../prisma/prisma.service';
import { PrototypesRepository } from './prototypes.repository';

describe('PrototypesRepository (Dynamic Queries & Pagination)', () => {
  let repository: PrototypesRepository;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      $transaction: jest.fn(),
      prototype: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      prototypeRevision: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    repository = new PrototypesRepository(prismaMock as unknown as PrismaService);
  });

  it('deve montar consulta com filtros dinâmicos de nome, primitive, data e hasCircular', async () => {
    const fakeData = [
      { id: 1, name: 'Protótipo Alpha', primitive: 100, component: new Date() },
    ];
    prismaMock.$transaction.mockResolvedValue([fakeData, 1]);

    const result = await repository.findAll({
      page: 2,
      limit: 5,
      name: 'Alpha',
      minPrimitive: 50,
      maxPrimitive: 200,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T23:59:59.999Z',
      hasCircular: true,
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.prototype.findMany).toHaveBeenCalledWith({
      where: {
        name: { contains: 'Alpha' },
        primitive: { gte: 50, lte: 200 },
        component: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2024-12-31T23:59:59.999Z'),
        },
        circularReference: { isNot: null },
      },
      skip: 5,
      take: 5,
      orderBy: { name: 'desc' },
      include: expect.any(Object),
    });
    expect(prismaMock.prototype.count).toHaveBeenCalledWith({
      where: {
        name: { contains: 'Alpha' },
        primitive: { gte: 50, lte: 200 },
        component: {
          gte: new Date('2024-01-01T00:00:00.000Z'),
          lte: new Date('2024-12-31T23:59:59.999Z'),
        },
        circularReference: { isNot: null },
      },
    });

    expect(result.data).toEqual(fakeData);
    expect(result.meta).toEqual({
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it('deve usar valores padrão quando nenhum filtro é passado', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    const result = await repository.findAll({});

    expect(prismaMock.prototype.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 10,
      orderBy: { id: 'asc' },
      include: expect.any(Object),
    });
    expect(result.meta.totalPages).toBe(0);
  });
});
