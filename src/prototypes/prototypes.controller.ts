import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from '../common/pagination';
import { ClonePrototypeDto } from './dto/clone-prototype.dto';
import { CreatePrototypeDto } from './dto/create-prototype.dto';
import { VersionedUpdatePrototypeDto } from './dto/update-prototype.dto';
import { PrototypeFilterDto } from './dto/prototype-filter.dto';
import {
  PaginatedPrototypesEntity,
  PrototypeEntity,
  PrototypeRevisionEntity,
  PrototypeTemplateEntity,
} from './entities/prototype.entity';
import { PrototypesService } from './prototypes.service';

@ApiTags('prototypes')
@Controller('prototypes')
export class PrototypesController {
  // Leitura é pública; toda escrita exige token de acesso, e apagar exige o papel ADMIN.
  constructor(private readonly prototypes: PrototypesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiOperation({ summary: 'Cria um protótipo.' })
  @ApiCreatedResponse({ type: PrototypeEntity })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  create(
    @Body() dto: CreatePrototypeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrototypeEntity> {
    return this.prototypes.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista os protótipos com paginação e filtros dinâmicos.',
    description:
      'Permite paginar e filtrar por busca textual (name), range numérico (minPrimitive, maxPrimitive), intervalo de datas e presença de referência circular.',
  })
  @ApiOkResponse({ type: PaginatedPrototypesEntity })
  @ApiBadRequestResponse({ description: 'Parâmetros de paginação/filtro inválidos.' })
  findAll(@Query() query: PrototypeFilterDto): Promise<PaginatedPrototypesEntity> {
    return this.prototypes.findAll(query);
  }

  // As rotas fixas vêm antes de `:id` para não serem capturadas por ela.
  @Get('templates')
  @ApiOperation({ summary: 'Lista os modelos do catálogo (Prototype Registry).' })
  @ApiOkResponse({ type: [PrototypeTemplateEntity] })
  listTemplates(): PrototypeTemplateEntity[] {
    return this.prototypes.listTemplates();
  }

  @Post('from-template/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiOperation({ summary: 'Cria um protótipo clonando um modelo do catálogo.' })
  @ApiCreatedResponse({ type: PrototypeEntity })
  @ApiNotFoundResponse({ description: 'Modelo não encontrado.' })
  createFromTemplate(
    @Param('key') key: string,
    @Body() dto: ClonePrototypeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrototypeEntity> {
    return this.prototypes.createFromTemplate(key, dto, user.id);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Lista os snapshots versionados de um protótipo.' })
  @ApiOkResponse({ type: [PrototypeRevisionEntity] })
  @ApiNotFoundResponse({ description: 'Protótipo não encontrado.' })
  listRevisions(@Param('id', ParseIntPipe) id: number): Promise<PrototypeRevisionEntity[]> {
    return this.prototypes.listRevisions(id);
  }

  @Post(':id/revisions/:version/restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiConflictResponse({ description: 'O protótipo mudou durante a restauração.' })
  @ApiOperation({ summary: 'Restaura um snapshot como uma nova versão.' })
  @ApiOkResponse({ type: PrototypeEntity })
  @ApiNotFoundResponse({ description: 'Protótipo ou versão não encontrado.' })
  restoreRevision(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: AuthUser,
  ): Promise<PrototypeEntity> {
    return this.prototypes.restoreRevision(id, version, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um protótipo pelo id.' })
  @ApiOkResponse({ type: PrototypeEntity })
  @ApiNotFoundResponse({ description: 'Protótipo não encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PrototypeEntity> {
    return this.prototypes.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiOperation({ summary: 'Atualiza parcialmente um protótipo.' })
  @ApiOkResponse({ type: PrototypeEntity })
  @ApiConflictResponse({ description: 'A versão informada está desatualizada; busque o protótipo antes de tentar novamente.' })
  @ApiBadRequestResponse({ description: 'Corpo inválido.' })
  @ApiNotFoundResponse({ description: 'Protótipo não encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VersionedUpdatePrototypeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrototypeEntity> {
    return this.prototypes.update(id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiForbiddenResponse({ description: 'O usuário não tem o papel ADMIN.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um protótipo (e o seu componente circular).' })
  @ApiNoContentResponse({ description: 'Removido.' })
  @ApiNotFoundResponse({ description: 'Protótipo não encontrado.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.prototypes.remove(id);
  }

  @Post(':id/clone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado.' })
  @ApiOperation({ summary: 'Clona um protótipo existente (padrão Prototype).' })
  @ApiCreatedResponse({ type: PrototypeEntity })
  @ApiNotFoundResponse({ description: 'Protótipo de origem não encontrado.' })
  clone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ClonePrototypeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PrototypeEntity> {
    return this.prototypes.clone(id, dto, user.id);
  }
}
