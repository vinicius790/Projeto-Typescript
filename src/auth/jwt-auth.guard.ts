import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest, Role } from './auth-user';
import { ROLES_KEY } from './auth.decorators';
import { AuthService } from './auth.service';

/**
 * Protege uma rota: exige `Authorization: Bearer <token de acesso>` válido
 * (401 se faltar ou for inválido) e, quando a rota tem `@Roles(...)`, que o
 * usuário tenha um dos papéis (403 se não tiver).
 *
 * Nas rotas sem `@Roles`, o usuário vem só do token, sem consulta ao banco. Nas
 * rotas com `@Roles`, o papel é lido do BANCO a cada requisição: quem é rebaixado
 * perde o acesso na hora, sem esperar o token de acesso vencer.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Informe o token de acesso no cabeçalho "Authorization: Bearer <token>".',
      );
    }

    const user = this.auth.verifyAccessToken(token);
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const role = await this.auth.currentRole(user.id);
    if (!role) {
      throw new UnauthorizedException('Usuário do token não existe mais.');
    }
    user.role = role;
    if (!roles.includes(role)) {
      throw new ForbiddenException(`Esta operação exige o papel ${roles.join(' ou ')}.`);
    }
    return true;
  }
}
