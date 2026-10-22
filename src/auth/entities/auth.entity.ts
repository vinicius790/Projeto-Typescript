import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser, Role } from '../auth-user';
import { ROLES } from '../auth-user';

// Classes de resposta: descrevem para o OpenAPI o formato do que a API devolve.

export class AuthUserEntity implements AuthUser {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'ana@exemplo.com' })
  email!: string;

  @ApiProperty({ enum: ROLES, example: 'USER' })
  role!: Role;
}

export class UserEntity extends AuthUserEntity {
  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseEntity {
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ description: 'JWT de acesso, de vida curta. Vai no cabeçalho Authorization.' })
  accessToken!: string;

  @ApiProperty({ description: 'Validade do token de acesso, em segundos.', example: 900 })
  expiresIn!: number;

  @ApiProperty({ description: 'JWT de renovação, de vida longa. Só serve no /auth/refresh.' })
  refreshToken!: string;

  @ApiProperty({ type: () => UserEntity })
  user!: UserEntity;
}
