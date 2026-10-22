import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser, Role } from './auth-user';

export const ROLES_KEY = 'auth:roles';

/**
 * Restringe a rota aos papéis informados. Só tem efeito em rotas protegidas
 * pelo `JwtAuthGuard`, que é quem lê este metadado.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injeta no parâmetro o usuário autenticado pelo `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
