import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateStateOrderDto {
  @ApiProperty({
    description: 'Nome do cliente solicitante do serviço',
    example: 'Rodrigo Medeiros',
  })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({
    description: 'Nome do serviço ou produto solicitado',
    example: 'Corte Degradê Navalhado + Barba Terapia',
  })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiProperty({
    description: 'Valor total do serviço em centavos (ex: 8500 = R$ 85,00)',
    example: 8500,
  })
  @IsInt()
  @IsPositive()
  amountInCents!: number;
}
