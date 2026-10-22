import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PublishEventDemoDto {
  @ApiProperty({
    description: 'Nome do evento de domínio a ser publicado.',
    example: 'prototype.created',
  })
  @IsString()
  @IsNotEmpty()
  eventName!: string;

  @ApiProperty({
    description: 'Carga útil (payload) do evento.',
    example: { id: 1, name: 'Protótipo Demo', primitive: 123, actorId: 1 },
  })
  @IsObject()
  payload!: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Correlation-ID opcional para rastreabilidade.',
    example: 'demo-trace-12345',
  })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
