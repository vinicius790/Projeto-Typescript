import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AuthorizeTransactionDto {
  @ApiPropertyOptional({
    description: 'Identificador único da transação (gerado automaticamente se omitido)',
    example: 'TX-2026-9081',
  })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiProperty({
    description: 'Identificador da conta bancária / cliente solicitante',
    example: 'ACC-54912',
  })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({
    description: 'Valor da operação em centavos (ex: 12000 = R$ 120,00)',
    example: 12000,
  })
  @IsInt()
  @IsPositive()
  amountInCents!: number;

  @ApiPropertyOptional({
    description: 'Código da moeda (ISO 4217)',
    example: 'BRL',
    default: 'BRL',
  })
  @IsString()
  @IsOptional()
  currency: string = 'BRL';

  @ApiProperty({
    description: 'Saldo contábil disponível em conta em centavos',
    example: 50000,
  })
  @IsInt()
  @Min(0)
  accountBalanceInCents!: number;

  @ApiProperty({
    description: 'Limite diário concedido para a conta em centavos',
    example: 100000,
  })
  @IsInt()
  @Min(0)
  dailyLimitInCents!: number;

  @ApiProperty({
    description: 'Volume já gasto acumulado no dia em centavos',
    example: 20000,
  })
  @IsInt()
  @Min(0)
  dailySpentInCents!: number;

  @ApiProperty({
    description: 'Score de risco antifraude (0 a 100; >= 85 é bloqueio imediato, >= 70 mesa manual)',
    example: 15,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  customerRiskScore!: number;

  @ApiPropertyOptional({
    description: 'Tipo de esteira a executar (financeira completa ou agendamento direto)',
    enum: ['financial', 'scheduling'],
    default: 'financial',
  })
  @IsIn(['financial', 'scheduling'])
  @IsOptional()
  pipelineType?: 'financial' | 'scheduling' = 'financial';
}
