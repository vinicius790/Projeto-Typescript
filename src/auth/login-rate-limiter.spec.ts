import type { LoginAttempt, Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  LoginRateLimiter,
  TooManyLoginAttemptsException,
} from './login-rate-limiter';

const NOW = Date.UTC(2026, 0, 1);

/** Tabela `LoginAttempt` em memória, com o comportamento do Prisma que o limitador usa. */
function createPrismaMock() {
  const rows = new Map<string, LoginAttempt>();
  return {
    rows,
    loginAttempt: {
      deleteMany: jest.fn(({ where }: Prisma.LoginAttemptDeleteManyArgs) => {
        let count = 0;
        for (const row of [...rows.values()]) {
          const resetAt = where?.resetAt as { lte: Date } | undefined;
          const byKey = where?.key === undefined || row.key === where.key;
          const expired = resetAt === undefined || row.resetAt <= resetAt.lte;
          if (byKey && expired) {
            rows.delete(row.key);
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      upsert: jest.fn(({ where, create }: Prisma.LoginAttemptUpsertArgs) => {
        const key = where.key ?? '';
        const existing = rows.get(key);
        const row: LoginAttempt = existing
          ? { ...existing, attempts: existing.attempts + 1 }
          : { key, attempts: 1, resetAt: new Date(create.resetAt) };
        rows.set(key, row);
        return Promise.resolve(row);
      }),
    },
  };
}

describe('LoginRateLimiter', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let limiter: LoginRateLimiter;

  /** Gasta todas as tentativas permitidas da chave. */
  async function exhaust(key: string, now = NOW): Promise<void> {
    for (let attempt = 0; attempt < LOGIN_MAX_ATTEMPTS; attempt++) {
      await expect(limiter.consume(key, now)).resolves.toBe(0);
    }
  }

  beforeEach(() => {
    prisma = createPrismaMock();
    limiter = new LoginRateLimiter(prisma as unknown as PrismaService);
  });

  it(`libera ${LOGIN_MAX_ATTEMPTS} tentativas e bloqueia a seguinte`, async () => {
    await exhaust('ip|ana');

    await expect(limiter.consume('ip|ana', NOW)).resolves.toBe(LOGIN_WINDOW_MS / 1000);
  });

  it('incrementa com um único upsert atômico, criando a janela na primeira tentativa', async () => {
    await limiter.consume('k', NOW);

    expect(prisma.loginAttempt.upsert).toHaveBeenCalledWith({
      where: { key: 'k' },
      create: { key: 'k', attempts: 1, resetAt: new Date(NOW + LOGIN_WINDOW_MS) },
      update: { attempts: { increment: 1 } },
    });
  });

  it('informa quanto falta para a janela reabrir, arredondando para cima', async () => {
    await exhaust('k');

    await expect(limiter.consume('k', NOW + LOGIN_WINDOW_MS - 1500)).resolves.toBe(2);
    await expect(limiter.consume('k', NOW + LOGIN_WINDOW_MS - 1)).resolves.toBe(1);
  });

  it('reabre quando a janela acaba, apagando as janelas vencidas de todas as chaves', async () => {
    await exhaust('k');
    await limiter.consume('outra', NOW);

    await expect(limiter.consume('k', NOW + LOGIN_WINDOW_MS)).resolves.toBe(0);

    expect(prisma.loginAttempt.deleteMany).toHaveBeenLastCalledWith({
      where: { resetAt: { lte: new Date(NOW + LOGIN_WINDOW_MS) } },
    });
    expect([...prisma.rows.keys()]).toEqual(['k']);
    expect(prisma.rows.get('k')?.attempts).toBe(1);
  });

  it('as chaves são independentes', async () => {
    await exhaust('ip1|ana');

    await expect(limiter.consume('ip2|ana', NOW)).resolves.toBe(0);
    await expect(limiter.consume('ip1|bia', NOW)).resolves.toBe(0);
  });

  it('reset apaga a contagem da chave', async () => {
    await exhaust('k');

    await limiter.reset('k');

    expect(prisma.loginAttempt.deleteMany).toHaveBeenLastCalledWith({ where: { key: 'k' } });
    await expect(limiter.consume('k', NOW)).resolves.toBe(0);
  });

  it('se outro processo criar a chave ao mesmo tempo (P2002), tenta de novo uma vez', async () => {
    const conflict = new PrismaRuntime.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'teste',
    });
    prisma.loginAttempt.upsert.mockRejectedValueOnce(conflict);

    await expect(limiter.consume('k', NOW)).resolves.toBe(0);
    expect(prisma.loginAttempt.upsert).toHaveBeenCalledTimes(2);

    prisma.loginAttempt.upsert.mockRejectedValueOnce(conflict).mockRejectedValueOnce(conflict);
    await expect(limiter.consume('k', NOW)).rejects.toThrow('Unique constraint failed');
  });

  it('a exceção responde 429 e guarda o Retry-After', () => {
    const error = new TooManyLoginAttemptsException(42);

    expect(error.getStatus()).toBe(429);
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.message).toBe('Muitas tentativas de login. Tente de novo em 42 s.');
  });
});
