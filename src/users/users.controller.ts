import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators';
import { UserEntity } from '../auth/entities/auth.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from '../common/pagination';
import { ChangeRoleDto } from './dto/change-role.dto';
import { PaginatedUsersEntity } from './entities/users.entity';
import { UsersService } from './users.service';

/** Administração de usuários: todas as rotas exigem o papel ADMIN. */
@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
@ApiForbiddenResponse({ description: 'O usuário não tem o papel ADMIN.' })
@Controller('users')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os usuários, com paginação.' })
  @ApiOkResponse({ type: PaginatedUsersEntity })
  @ApiBadRequestResponse({ description: 'Parâmetros de paginação inválidos.' })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedUsersEntity> {
    return this.users.findAll(query);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Promove ou rebaixa um usuário (USER ou ADMIN).' })
  @ApiOkResponse({ type: UserEntity })
  @ApiBadRequestResponse({ description: 'Papel inválido.' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  @ApiConflictResponse({ description: 'Rebaixaria o último ADMIN.' })
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
  ): Promise<UserEntity> {
    return this.users.changeRole(id, dto.role);
  }
}
