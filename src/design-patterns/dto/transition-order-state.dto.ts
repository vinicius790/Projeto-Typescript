import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransitionOrderStateDto {
  @ApiProperty({
    description: 'Ação a ser executada na máquina de estados da ordem',
    enum: [
      'submit_payment',
      'confirm_payment',
      'start_processing',
      'complete',
      'cancel',
    ],
    example: 'submit_payment',
  })
  @IsIn([
    'submit_payment',
    'confirm_payment',
    'start_processing',
    'complete',
    'cancel',
  ])
  @IsNotEmpty()
  action!:
    | 'submit_payment'
    | 'confirm_payment'
    | 'start_processing'
    | 'complete'
    | 'cancel';

  @ApiPropertyOptional({
    description: 'Método de pagamento escolhido (para a ação submit_payment)',
    example: 'PIX',
  })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'ID da transação retornado pela adquirente (obrigatório para confirm_payment)',
    example: 'TX-GATEWAY-88412',
  })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'ID ou nome do operador/barbeiro responsável (para start_processing)',
    example: 'BARBER-FELIPE',
  })
  @IsString()
  @IsOptional()
  operatorId?: string;

  @ApiPropertyOptional({
    description: 'Notas ou observações finais de conclusão (para complete)',
    example: 'Serviço executado com sucesso e produto pós-barba aplicado.',
  })
  @IsString()
  @IsOptional()
  completionNotes?: string;

  @ApiPropertyOptional({
    description: 'Justificativa do cancelamento (para cancel)',
    example: 'Cliente desistiu antes do início do atendimento.',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
