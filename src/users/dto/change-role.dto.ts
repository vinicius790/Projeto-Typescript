import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { Role } from '../../auth/auth-user';
import { ROLES } from '../../auth/auth-user';

export class ChangeRoleDto {
  @ApiProperty({ enum: ROLES, example: 'ADMIN' })
  @IsIn(ROLES, { message: `role deve ser ${ROLES.join(' ou ')}.` })
  role!: Role;
}
