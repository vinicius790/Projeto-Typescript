import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';

export type PrototypeSortField = 'id' | 'name' | 'primitive' | 'component' | 'createdAt' | 'version';
export type SortOrderDirection = 'asc' | 'desc';

export class PrototypeFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtro por nome parcial (busca insensível a maiúsculas/minúsculas).',
    example: 'relatório',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtro por valor mínimo do campo primitive.',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minPrimitive?: number;

  @ApiPropertyOptional({
    description: 'Filtro por valor máximo do campo primitive.',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxPrimitive?: number;

  @ApiPropertyOptional({
    description: 'Data inicial para filtro do componente em formato ISO 8601.',
    example: '2024-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Data final para filtro do componente em formato ISO 8601.',
    example: '2024-12-31T23:59:59.999Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por protótipos que possuem ou não componente circular associado.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  hasCircular?: boolean;

  @ApiPropertyOptional({
    description: 'Campo para ordenação dinâmica dos resultados.',
    enum: ['id', 'name', 'primitive', 'component', 'createdAt', 'version'],
    default: 'id',
  })
  @IsOptional()
  @IsIn(['id', 'name', 'primitive', 'component', 'createdAt', 'version'])
  sortBy: PrototypeSortField = 'id';

  @ApiPropertyOptional({
    description: 'Direção da ordenação (ascendente ou descendente).',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: SortOrderDirection = 'asc';
}
