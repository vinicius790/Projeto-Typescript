import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Provedor de pagamento que será adaptado',
    enum: ['stripe', 'paypal', 'mercadopago'],
    example: 'stripe',
  })
  @IsIn(['stripe', 'paypal', 'mercadopago'], {
    message: 'Provedor deve ser: stripe, paypal ou mercadopago',
  })
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({
    description: 'Identificador único do pedido',
    example: 'PED-9821',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    description: 'Valor total a cobrar em centavos (ex: 15000 = R$ 150,00)',
    example: 15000,
  })
  @IsInt()
  @IsPositive()
  amountInCents!: number;

  @ApiProperty({
    description: 'Código da moeda (ISO 4217)',
    example: 'BRL',
    default: 'BRL',
  })
  @IsString()
  @IsNotEmpty()
  currency: string = 'BRL';

  @ApiProperty({
    description: 'E-mail do cliente pagador',
    example: 'cliente@exemplo.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  customerEmail!: string;
}
