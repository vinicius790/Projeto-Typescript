import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CalculateFineDto {
  @ApiProperty({
    description: 'Valor base do débito/obrigação em Reais.',
    example: 1500.0,
  })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  baseAmount!: number;

  @ApiProperty({
    description: 'Dias corridos de atraso desde o vencimento.',
    example: 25,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  overdueDays!: number;

  @ApiPropertyOptional({
    description: 'Tipo de estratégia de cálculo de multa progressiva.',
    enum: ['linear', 'tiered', 'compound', 'regulatory'],
    default: 'tiered',
  })
  @IsOptional()
  @IsIn(['linear', 'tiered', 'compound', 'regulatory'])
  strategyType: 'linear' | 'tiered' | 'compound' | 'regulatory' = 'tiered';

  @ApiPropertyOptional({
    description: 'Dias de carência/tolerância sem cobrança de multa.',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  gracePeriodDays: number = 0;

  @ApiPropertyOptional({
    description: 'Número de reincidências prévias (usado na estratégia escalonada para agravar multa base).',
    example: 1,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  recurrenceCount: number = 0;
}
