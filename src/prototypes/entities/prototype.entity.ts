import { ApiProperty } from '@nestjs/swagger';
import type { CircularReference, PrototypeRevision } from '@prisma/client';
import { PaginationMeta } from '../../common/pagination';
import type { PrototypeRecord } from '../prototype.model';

// Classes de resposta: descrevem para o OpenAPI o formato do que a API devolve.

export class CircularReferenceEntity implements CircularReference {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'componente A' })
  label!: string;

  @ApiProperty({ description: 'Id do protótipo dono deste componente.', example: 1 })
  prototypeId!: number;
}

export class PrototypeEntity implements PrototypeRecord {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Relatório mensal' })
  name!: string;

  @ApiProperty({ example: 245 })
  primitive!: number;

  @ApiProperty({ example: '2024-06-15T12:00:00.000Z' })
  component!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ description: 'Versão atual; cresce a cada edição e restauração.', example: 3 })
  version!: number;

  @ApiProperty({
    description: 'Id do protótipo do qual este foi clonado (null se não é clone).',
    type: Number,
    nullable: true,
    example: null,
  })
  clonedFromId!: number | null;

  @ApiProperty({ type: () => CircularReferenceEntity, nullable: true })
  circularReference!: CircularReferenceEntity | null;
}

/** Snapshot histórico; não expõe a identidade interna de quem fez a alteração. */
export class PrototypeRevisionEntity implements Omit<PrototypeRevision, 'actorId'> {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 1 })
  prototypeId!: number;

  @ApiProperty({ example: 3 })
  version!: number;

  @ApiProperty({ example: 'Relatório revisado' })
  name!: string;

  @ApiProperty({ example: 245 })
  primitive!: number;

  @ApiProperty({ example: '2024-06-15T12:00:00.000Z' })
  component!: Date;

  @ApiProperty({ type: String, nullable: true, example: 'componente A' })
  circularReferenceLabel!: string | null;

  @ApiProperty({ example: '2026-10-05T12:00:00.000Z' })
  recordedAt!: Date;
}

export class PaginatedPrototypesEntity {
  @ApiProperty({ type: () => [PrototypeEntity] })
  data!: PrototypeEntity[];

  @ApiProperty({ type: () => PaginationMeta })
  meta!: PaginationMeta;
}

export class PrototypeTemplateEntity {
  @ApiProperty({ description: 'Chave usada em `POST /prototypes/from-template/:key`.' })
  key!: string;

  @ApiProperty({ example: 'Protótipo básico' })
  name!: string;

  @ApiProperty({ example: 0 })
  primitive!: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  component!: Date;

  @ApiProperty({ type: String, nullable: true, example: null })
  circularReferenceLabel!: string | null;
}
