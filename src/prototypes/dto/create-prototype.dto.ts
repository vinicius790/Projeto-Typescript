import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Limites do tipo `Int` do Prisma (inteiro de 32 bits com sinal).
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export class CircularReferenceDto {
  @ApiProperty({ description: 'Rótulo do componente circular.', example: 'componente A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;
}

export class CreatePrototypeDto {
  @ApiProperty({ example: 'Relatório mensal', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Valor primitivo (inteiro de 32 bits).', example: 245 })
  @IsInt()
  @Min(INT32_MIN)
  @Max(INT32_MAX)
  primitive!: number;

  @ApiProperty({
    description: 'Data do componente, em ISO 8601.',
    example: '2024-06-15T12:00:00.000Z',
    format: 'date-time',
  })
  @IsISO8601({ strict: true })
  component!: string;

  @ApiPropertyOptional({
    description: 'Componente com referência de volta ao protótipo (relação 1:1).',
    type: () => CircularReferenceDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CircularReferenceDto)
  circularReference?: CircularReferenceDto;
}
