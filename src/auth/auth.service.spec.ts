import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RefreshToken, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { signJwt, verifyJwt } from './jwt';
import type { LoginRateLimiter } from './login-rate-limiter';
import { TooManyLoginAttemptsException } from './login-rate-limiter';
import { hashPassword } from './password';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
const PASSWORD = 'senha-de-teste';
const IP = '203.0.113.7';
const settings: Record<string, unknown> = {
  JWT_SECRET: SECRET,
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 3600,
};

/** Tabela de tokens de renovação em memória, com o comportamento do Prisma que o serviço usa. */
function createRefreshTokenStore() {
  const rows = new Map<string, RefreshToken>();
  const matches = (row: RefreshToken, where: Prisma.RefreshTokenWhereInput = {}): boolean =>
    (where.id === undefined || row.id === where.id) &&
    (where.familyId === undefined || row.familyId === where.familyId) &&
    (where.revokedAt === undefined || (where.revokedAt === null && row.revokedAt === null));
  return {
    rows,
    findUnique: jest.fn(({ where }: Prisma.RefreshTokenFindUniqueArgs) =>
      Promise.resolve(rows.get(where.id ?? '') ?? null),
    ),
    create: jest.fn(({ data }: Prisma.RefreshTokenCreateArgs) => {
      const input = data as Prisma.RefreshTokenUncheckedCreateInput;
      const row: RefreshToken = {
        id: input.id,
        familyId: input.familyId,
        userId: input.userId,
        expiresAt: new Date(input.expiresAt),
        revokedAt: null,
        createdAt: new Date(),
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    }),
    updateMany: jest.fn(({ where, data }: Prisma.RefreshTokenUpdateManyArgs) => {
      const targets = [...rows.values()].filter((row) => matches(row, where));
      for (const row of targets) {
        row.revokedAt = data.revokedAt as Date;
      }
      return Promise.resolve({ count: targets.length });
    }),
    deleteMany: jest
      .fn<Promise<Prisma.BatchPayload>, [Prisma.RefreshTokenDeleteManyArgs]>()
      .mockResolvedValue({ count: 0 }),
  };
}

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn<Promise<User | null>, [Prisma.UserFindUniqueArgs]>(),
      count: jest.fn<Promise<number>, []>(),
      create: jest.fn<Promise<User>, [Prisma.UserCreateArgs]>(),
    },
    refreshToken: createRefreshTokenStore(),
  };
}

/** Limite de tentativas simulado: libera tudo, salvo quando o teste disser o contrário. */
function createLimiterMock() {
  return {
    consume: jest.fn<Promise<number>, [string]>().mockResolvedValue(0),
    reset: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'teste',
  });
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let limiter: ReturnType<typeof createLimiterMock>;
  let service: AuthService;
  let passwordHash: string;

  function user(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      email: 'ana@exemplo.com',
      passwordHash,
      role: 'USER',
      firstAdmin: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  /** Faz um login de verdade e devolve os tokens emitidos (já gravados no "banco"). */
  async function loginAs(account: User) {
    prisma.user.findUnique.mockResolvedValue(account);
    return service.login({ email: account.email, password: PASSWORD }, IP);
  }

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    limiter = createLimiterMock();
    const config = { getOrThrow: (key: string) => settings[key] };
    service = new AuthService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      limiter as unknown as LoginRateLimiter,
    );
  });

  describe('register', () => {
    it('grava o e-mail em minúsculas e a senha como hash, nunca em claro', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(3);
      prisma.user.create.mockResolvedValue(user());

      await service.register({ email: 'Ana@Exemplo.com', password: PASSWORD });

      const data = prisma.user.create.mock.calls[0]?.[0].data;
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'ana@exemplo.com' } });
      expect(data?.email).toBe('ana@exemplo.com');
      expect(data?.passwordHash).toMatch(/^scrypt\$/);
      expect(data?.passwordHash).not.toContain(PASSWORD);
    });

    it('dá o papel ADMIN (marcado como primeiro) ao primeiro usuário e USER aos seguintes', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user());

      prisma.user.count.mockResolvedValueOnce(0);
      await service.register({ email: 'primeiro@exemplo.com', password: PASSWORD });
      prisma.user.count.mockResolvedValueOnce(1);
      await service.register({ email: 'segundo@exemplo.com', password: PASSWORD });

      expect(prisma.user.create.mock.calls[0]?.[0].data).toMatchObject({
        role: 'ADMIN',
        firstAdmin: true,
      });
      expect(prisma.user.create.mock.calls[1]?.[0].data.role).toBe('USER');
      expect(prisma.user.create.mock.calls[1]?.[0].data.firstAdmin).toBeUndefined();
    });

    it('quem perde a corrida pelo primeiro ADMIN (P2002 em firstAdmin) é gravado como USER', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValueOnce(user({ id: 2 }));

      const response = await service.register({ email: 'ana@exemplo.com', password: PASSWORD });

      expect(prisma.user.create).toHaveBeenCalledTimes(2);
      expect(prisma.user.create.mock.calls[1]?.[0].data).toEqual({
        email: 'ana@exemplo.com',
        passwordHash: expect.stringMatching(/^scrypt\$/) as unknown,
        role: 'USER',
      });
      expect(response.user.role).toBe('USER');
    });

    it('repassa erros do banco que não são da corrida pelo primeiro ADMIN', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockRejectedValueOnce(new Error('banco fora do ar'));

      await expect(
        service.register({ email: 'ana@exemplo.com', password: PASSWORD }),
      ).rejects.toThrow('banco fora do ar');
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('devolve os tokens e o usuário, sem o hash da senha', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(user({ id: 5, role: 'ADMIN' }));

      const response = await service.register({ email: 'ana@exemplo.com', password: PASSWORD });

      expect(response.tokenType).toBe('Bearer');
      expect(response.expiresIn).toBe(900);
      expect(response.user).toEqual({
        id: 5,
        email: 'ana@exemplo.com',
        role: 'ADMIN',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(JSON.stringify(response)).not.toContain('scrypt');
      expect(verifyJwt(response.accessToken, SECRET)).toMatchObject({
        sub: '5',
        email: 'ana@exemplo.com',
        role: 'ADMIN',
        typ: 'access',
      });
      expect(verifyJwt(response.refreshToken, SECRET)).toMatchObject({ sub: '5', typ: 'refresh' });
    });

    it('aplica as validades configuradas a cada tipo de token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(user());

      const response = await service.register({ email: 'ana@exemplo.com', password: PASSWORD });
      const access = verifyJwt(response.accessToken, SECRET);
      const refresh = verifyJwt(response.refreshToken, SECRET);

      expect(access.exp - access.iat).toBe(900);
      expect(refresh.exp - refresh.iat).toBe(3600);
    });

    it('grava o token de renovação (id = jti) e apaga os vencidos do usuário', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.create.mockResolvedValue(user({ id: 7 }));
      const before = Date.now();

      const response = await service.register({ email: 'ana@exemplo.com', password: PASSWORD });

      const { jti } = verifyJwt(response.refreshToken, SECRET);
      const stored = prisma.refreshToken.rows.get(jti as string);
      expect(stored).toMatchObject({ userId: 7, revokedAt: null });
      expect(stored?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 7, expiresAt: { lt: expect.any(Date) as unknown } },
      });
    });

    it('lança ConflictException quando o e-mail já existe e não grava nada', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      await expect(
        service.register({ email: 'ana@exemplo.com', password: PASSWORD }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('devolve os tokens quando a senha confere', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ id: 9 }));

      const response = await service.login({ email: 'ANA@exemplo.com', password: PASSWORD }, IP);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'ana@exemplo.com' } });
      expect(service.verifyAccessToken(response.accessToken)).toEqual({
        id: 9,
        email: 'ana@exemplo.com',
        role: 'USER',
      });
    });

    it('responde com a MESMA mensagem para senha errada e para e-mail inexistente', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user());
      await expect(
        service.login({ email: 'ana@exemplo.com', password: 'senha-errada' }, IP),
      ).rejects.toThrow('E-mail ou senha inválidos.');

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'ninguem@exemplo.com', password: PASSWORD }, IP),
      ).rejects.toThrow('E-mail ou senha inválidos.');
    });

    it('lança UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'a@b.co', password: 'x' }, IP)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('consulta o limite com a chave IP + e-mail (minúsculo) e bloqueia sem ir ao banco', async () => {
      limiter.consume.mockResolvedValueOnce(42);

      const blocked = service.login({ email: 'ANA@exemplo.com', password: PASSWORD }, IP);

      await expect(blocked).rejects.toThrow(TooManyLoginAttemptsException);
      await blocked.catch((error: TooManyLoginAttemptsException) => {
        expect(error.getStatus()).toBe(429);
        expect(error.retryAfterSeconds).toBe(42);
      });
      expect(limiter.consume).toHaveBeenCalledWith(`${IP}|ana@exemplo.com`);
      // Bloqueado antes de consultar o banco ou conferir a senha.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('zera a contagem só quando o login dá certo', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      await expect(
        service.login({ email: 'ana@exemplo.com', password: 'senha-errada' }, IP),
      ).rejects.toThrow(UnauthorizedException);
      expect(limiter.reset).not.toHaveBeenCalled();

      await service.login({ email: 'ana@exemplo.com', password: PASSWORD }, IP);
      expect(limiter.reset).toHaveBeenCalledWith(`${IP}|ana@exemplo.com`);
    });
  });

  describe('refresh (rotação)', () => {
    it('troca um token de renovação válido por um novo par, com os dados atuais do usuário', async () => {
      const { refreshToken } = await loginAs(user({ id: 4 }));
      prisma.user.findUnique.mockResolvedValue(user({ id: 4, role: 'ADMIN' }));

      const response = await service.refresh({ refreshToken });

      expect(prisma.user.findUnique).toHaveBeenLastCalledWith({ where: { id: 4 } });
      expect(service.verifyAccessToken(response.accessToken).role).toBe('ADMIN');
      expect(verifyJwt(response.refreshToken, SECRET).typ).toBe('refresh');
    });

    it('revoga o token usado e mantém o novo na mesma família', async () => {
      const { refreshToken } = await loginAs(user());
      const oldJti = verifyJwt(refreshToken, SECRET).jti as string;

      const response = await service.refresh({ refreshToken });

      const newJti = verifyJwt(response.refreshToken, SECRET).jti as string;
      const oldRow = prisma.refreshToken.rows.get(oldJti);
      const newRow = prisma.refreshToken.rows.get(newJti);
      expect(newJti).not.toBe(oldJti);
      expect(oldRow?.revokedAt).toBeInstanceOf(Date);
      expect(newRow?.revokedAt).toBeNull();
      expect(newRow?.familyId).toBe(oldRow?.familyId);
    });

    it('reuso de um token já usado encerra a sessão inteira (inclusive o token novo)', async () => {
      const { refreshToken } = await loginAs(user());
      const rotated = await service.refresh({ refreshToken });

      await expect(service.refresh({ refreshToken })).rejects.toThrow(
        'Token de renovação já usado ou revogado; a sessão foi encerrada por segurança.',
      );
      await expect(service.refresh({ refreshToken: rotated.refreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('não mexe nas outras sessões do mesmo usuário', async () => {
      const first = await loginAs(user());
      const second = await loginAs(user());
      await service.refresh({ refreshToken: first.refreshToken });
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(service.refresh({ refreshToken: second.refreshToken })).resolves.toMatchObject({
        tokenType: 'Bearer',
      });
    });

    it('de duas renovações simultâneas com o mesmo token, só uma passa', async () => {
      const { refreshToken } = await loginAs(user());

      const results = await Promise.allSettled([
        service.refresh({ refreshToken }),
        service.refresh({ refreshToken }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    });

    it('recusa um token assinado que não foi emitido (não está no banco)', async () => {
      const refreshToken = signJwt({ sub: '4', typ: 'refresh', jti: 'inventado' }, SECRET, 60);

      await expect(service.refresh({ refreshToken })).rejects.toThrow(
        'Token de renovação revogado.',
      );
    });

    it('recusa um token de renovação sem jti (formato da versão 2.0.0)', async () => {
      const refreshToken = signJwt({ sub: '4', typ: 'refresh' }, SECRET, 60);

      await expect(service.refresh({ refreshToken })).rejects.toThrow(
        'Token de renovação sem identificador.',
      );
    });

    it('recusa um token cujo sub não é o dono do registro', async () => {
      const { refreshToken } = await loginAs(user({ id: 4 }));
      const { jti } = verifyJwt(refreshToken, SECRET);
      const forged = signJwt({ sub: '5', typ: 'refresh', jti }, SECRET, 60);

      await expect(service.refresh({ refreshToken: forged })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('recusa um token de ACESSO usado como token de renovação', async () => {
      const accessToken = signJwt({ sub: '4', typ: 'access' }, SECRET, 60);

      await expect(service.refresh({ refreshToken: accessToken })).rejects.toThrow(
        'Tipo de token incorreto para esta operação.',
      );
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('recusa token expirado, adulterado ou de outro segredo', async () => {
      const claims = { sub: '4', typ: 'refresh', jti: 'x' };
      const expired = signJwt(claims, SECRET, 60, Date.now() - 120_000);
      const foreign = signJwt(claims, `${SECRET}-outro`, 60);

      await expect(service.refresh({ refreshToken: expired })).rejects.toThrow('Token expirado.');
      await expect(service.refresh({ refreshToken: foreign })).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh({ refreshToken: 'abc' })).rejects.toThrow(UnauthorizedException);
    });

    it('recusa quando o usuário do token não existe mais', async () => {
      const { refreshToken } = await loginAs(user({ id: 4 }));
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken })).rejects.toThrow(
        'Usuário do token não existe mais.',
      );
    });
  });

  describe('logout', () => {
    it('revoga a sessão: nem o token apresentado nem os rotacionados a partir dele valem mais', async () => {
      const { refreshToken } = await loginAs(user());
      const rotated = await service.refresh({ refreshToken });

      await service.logout({ refreshToken: rotated.refreshToken });

      await expect(service.refresh({ refreshToken: rotated.refreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
      expect([...prisma.refreshToken.rows.values()].every((row) => row.revokedAt)).toBe(true);
    });

    it('pode ser repetido sem erro e não afeta outras sessões', async () => {
      const first = await loginAs(user());
      const second = await loginAs(user());

      await service.logout(first);
      await expect(service.logout(first)).resolves.toBeUndefined();

      await expect(service.refresh(second)).resolves.toMatchObject({ tokenType: 'Bearer' });
    });

    it('recusa token inválido ou de acesso', async () => {
      const { accessToken } = await loginAs(user());

      await expect(service.logout({ refreshToken: 'abc' })).rejects.toThrow(UnauthorizedException);
      await expect(service.logout({ refreshToken: accessToken })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('currentRole', () => {
    it('lê o papel atual do banco', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ id: 3, role: 'ADMIN' }));

      await expect(service.currentRole(3)).resolves.toBe('ADMIN');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
        select: { role: true },
      });
    });

    it('devolve null para usuário apagado e USER para papel desconhecido no banco', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.currentRole(3)).resolves.toBeNull();

      prisma.user.findUnique.mockResolvedValueOnce(user({ role: 'ROOT' }));
      await expect(service.currentRole(3)).resolves.toBe('USER');
    });
  });

  describe('verifyAccessToken', () => {
    it('devolve o usuário contido no token', () => {
      const payload = { sub: '2', email: 'a@b.co', role: 'ADMIN', typ: 'access' };
      const token = signJwt(payload, SECRET, 60);

      expect(service.verifyAccessToken(token)).toEqual({ id: 2, email: 'a@b.co', role: 'ADMIN' });
    });

    it('recusa um token de renovação', () => {
      const token = signJwt({ sub: '2', typ: 'refresh', jti: 'x' }, SECRET, 60);

      expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
    });

    it.each([
      ['sem sub', { email: 'a@b.co', role: 'USER', typ: 'access' }],
      ['sub que não é um id', { sub: 'abc', email: 'a@b.co', role: 'USER', typ: 'access' }],
      ['sem e-mail', { sub: '2', role: 'USER', typ: 'access' }],
      ['papel desconhecido', { sub: '2', email: 'a@b.co', role: 'ROOT', typ: 'access' }],
    ])('recusa token assinado, mas %s', (_caso, payload) => {
      const token = signJwt(payload, SECRET, 60);

      expect(() => service.verifyAccessToken(token)).toThrow(UnauthorizedException);
    });

    it('converte erros do JWT em UnauthorizedException', () => {
      expect(() => service.verifyAccessToken('abc')).toThrow('Token malformado.');
      expect(() => service.verifyAccessToken('abc')).toThrow(UnauthorizedException);
    });
  });
});
