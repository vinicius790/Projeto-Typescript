import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Ajustes aplicados sobre o clone antes de ele ser gravado. O corpo é opcional. */
export class ClonePrototypeDto {
  @ApiPropertyOptional({
    description: 'Nome do novo registro. Se omitido, a API escolhe um nome padrão.',
    example: 'Relatório mensal (revisão)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}
