import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'ana@exemplo.com',
    passwordHash: 'scrypt$00$00',
    role: 'USER',
    firstAdmin: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock() {
  const tx = {
    /** Quantidade de linhas ADMIN travadas pelo UPDATE inicial. */
    $executeRaw: jest.fn<Promise<number>, [TemplateStringsArray, ...unknown[]]>(),
    user: {
      findUnique: jest.fn<Promise<User | null>, [Prisma.UserFindUniqueArgs]>(),
      update: jest.fn<Promise<User>, [Prisma.UserUpdateArgs]>(),
    },
    refreshToken: {
      updateMany: jest
        .fn<Promise<Prisma.BatchPayload>, [Prisma.RefreshTokenUpdateManyArgs]>()
        .mockResolvedValue({ count: 2 }),
    },
  };
  return {
    tx,
    user: {
      findMany: jest.fn<Promise<User[]>, [Prisma.UserFindManyArgs]>(),
      count: jest.fn<Promise<number>, []>(),
    },
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('pagina e devolve só os campos públicos', async () => {
      prisma.user.findMany.mockResolvedValue([user({ id: 3 })]);
      prisma.user.count.mockResolvedValue(21);

      const page = await service.findAll({ page: 3, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { id: 'asc' },
      });
      expect(page).toEqual({
        data: [
          {
            id: 3,
            email: 'ana@exemplo.com',
            role: 'USER',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        meta: { total: 21, page: 3, limit: 10, totalPages: 3 },
      });
      expect(JSON.stringify(page)).not.toContain('scrypt');
    });
  });

  describe('changeRole', () => {
    it('promove um USER a ADMIN', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(1);
      prisma.tx.user.findUnique.mockResolvedValue(user({ id: 2 }));
      prisma.tx.user.update.mockResolvedValue(user({ id: 2, role: 'ADMIN' }));

      const result = await service.changeRole(2, 'ADMIN');

      expect(prisma.tx.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { role: 'ADMIN' },
      });
      expect(prisma.tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 2, revokedAt: null },
        data: { revokedAt: expect.any(Date) as unknown },
      });
      expect(result).toEqual({
        id: 2,
        email: 'ana@exemplo.com',
        role: 'ADMIN',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    });

    it('trava as linhas ADMIN antes de ler o usuário', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(2);
      prisma.tx.user.findUnique.mockResolvedValue(user({ role: 'ADMIN' }));
      prisma.tx.user.update.mockResolvedValue(user());

      await service.changeRole(1, 'USER');

      const [sql] = prisma.tx.$executeRaw.mock.calls[0] ?? [];
      expect(sql?.join('?')).toBe(`UPDATE "User" SET "role" = "role" WHERE "role" = 'ADMIN'`);
      expect(prisma.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.tx.user.findUnique.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('rebaixa um ADMIN quando ainda resta outro', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(2);
      prisma.tx.user.findUnique.mockResolvedValue(user({ role: 'ADMIN' }));
      prisma.tx.user.update.mockResolvedValue(user({ role: 'USER' }));

      await expect(service.changeRole(1, 'USER')).resolves.toMatchObject({ role: 'USER' });
    });

    it('recusa (409) rebaixar o último ADMIN e não grava nada', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(1);
      prisma.tx.user.findUnique.mockResolvedValue(user({ role: 'ADMIN' }));

      await expect(service.changeRole(1, 'USER')).rejects.toThrow(ConflictException);
      await expect(service.changeRole(1, 'USER')).rejects.toThrow(
        'Não é possível remover o papel do último ADMIN.',
      );
      expect(prisma.tx.user.update).not.toHaveBeenCalled();
      expect(prisma.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('não grava nada quando o papel já é o pedido (inclusive o último ADMIN continuar ADMIN)', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(1);
      prisma.tx.user.findUnique.mockResolvedValue(user({ role: 'ADMIN' }));

      await expect(service.changeRole(1, 'ADMIN')).resolves.toMatchObject({ role: 'ADMIN' });
      expect(prisma.tx.user.update).not.toHaveBeenCalled();
      expect(prisma.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('responde 404 para usuário inexistente', async () => {
      prisma.tx.$executeRaw.mockResolvedValue(1);
      prisma.tx.user.findUnique.mockResolvedValue(null);

      await expect(service.changeRole(99, 'ADMIN')).rejects.toThrow(NotFoundException);
    });
  });
});
