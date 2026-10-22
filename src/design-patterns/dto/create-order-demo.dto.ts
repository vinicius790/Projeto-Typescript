import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ description: 'Nome do produto/serviço', example: 'Plano Pro' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Quantidade de unidades', example: 1 })
  @IsInt()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Preço unitário em Reais', example: 199.9 })
  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}

export class CreateOrderDemoDto {
  @ApiProperty({
    description: 'E-mail do cliente para faturamento',
    example: 'gerente@empresa.com',
  })
  @IsEmail({}, { message: 'Informe um e-mail corporativo válido' })
  customerEmail!: string;

  @ApiProperty({
    description: 'Lista de itens do pedido',
    type: [OrderItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'O pedido precisa conter ao menos 1 item' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
