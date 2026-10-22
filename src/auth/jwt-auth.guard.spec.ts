import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest, AuthUser, Role } from './auth-user';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const ana: AuthUser = { id: 1, email: 'ana@exemplo.com', role: 'USER' };

/**
 * Monta o guard com um serviço que só aceita o token "valido" e a rota com os
 * papéis dados. `dbRole` é o papel que está no banco (`null`: usuário apagado).
 */
function setup(
  authorization: string | undefined,
  roles?: Role[],
  user: AuthUser = ana,
  dbRole: Role | null = user.role,
) {
  const request = { headers: { authorization } } as unknown as AuthenticatedRequest;
  const verifyAccessToken = jest.fn((token: string): AuthUser => {
    if (token !== 'valido') {
      throw new UnauthorizedException('Token malformado.');
    }
    return { ...user };
  });
  const currentRole = jest.fn<Promise<Role | null>, [number]>().mockResolvedValue(dbRole);
  const guard = new JwtAuthGuard(
    { verifyAccessToken, currentRole } as unknown as AuthService,
    { getAllAndOverride: () => roles } as unknown as Reflector,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => setup,
    getClass: () => JwtAuthGuard,
  } as unknown as ExecutionContext;
  return { request, verifyAccessToken, currentRole, activate: () => guard.canActivate(context) };
}

describe('JwtAuthGuard', () => {
  it('libera a rota e anexa o usuário à requisição quando o token é válido', async () => {
    const { activate, request } = setup('Bearer valido');

    await expect(activate()).resolves.toBe(true);
    expect(request.user).toEqual(ana);
  });

  it.each([undefined, '', 'valido', 'Basic valido', 'Bearer', 'Bearer '])(
    'responde 401 sem consultar o token quando o cabeçalho é "%s"',
    async (authorization) => {
      const { activate, verifyAccessToken } = setup(authorization);

      await expect(activate()).rejects.toThrow(UnauthorizedException);
      expect(verifyAccessToken).not.toHaveBeenCalled();
    },
  );

  it('propaga o 401 do serviço quando o token é inválido', async () => {
    const { activate, request } = setup('Bearer invalido');

    await expect(activate()).rejects.toThrow('Token malformado.');
    expect(request.user).toBeUndefined();
  });

  it('libera qualquer usuário autenticado quando a rota não exige papel, sem ir ao banco', async () => {
    const withoutRoles = setup('Bearer valido', undefined);
    const emptyRoles = setup('Bearer valido', []);

    await expect(withoutRoles.activate()).resolves.toBe(true);
    await expect(emptyRoles.activate()).resolves.toBe(true);
    expect(withoutRoles.currentRole).not.toHaveBeenCalled();
    expect(emptyRoles.currentRole).not.toHaveBeenCalled();
  });

  it('responde 403 quando o usuário não tem o papel exigido', async () => {
    const { activate } = setup('Bearer valido', ['ADMIN']);

    await expect(activate()).rejects.toThrow(ForbiddenException);
    await expect(activate()).rejects.toThrow('Esta operação exige o papel ADMIN.');
  });

  it('libera quando o usuário tem um dos papéis exigidos', async () => {
    const admin: AuthUser = { ...ana, role: 'ADMIN' };

    await expect(setup('Bearer valido', ['ADMIN'], admin).activate()).resolves.toBe(true);
    await expect(setup('Bearer valido', ['USER', 'ADMIN']).activate()).resolves.toBe(true);
  });

  it('nas rotas com papel, vale o papel do BANCO, não o do token', async () => {
    const admin: AuthUser = { ...ana, role: 'ADMIN' };

    const demoted = setup('Bearer valido', ['ADMIN'], admin, 'USER');
    await expect(demoted.activate()).rejects.toThrow(ForbiddenException);
    expect(demoted.currentRole).toHaveBeenCalledWith(1);

    const promoted = setup('Bearer valido', ['ADMIN'], ana, 'ADMIN');
    await expect(promoted.activate()).resolves.toBe(true);
    expect(promoted.request.user).toEqual({ ...ana, role: 'ADMIN' });
  });

  it('responde 401 nas rotas com papel quando o usuário não existe mais', async () => {
    const { activate } = setup('Bearer valido', ['USER'], ana, null);

    await expect(activate()).rejects.toThrow(UnauthorizedException);
  });
});
