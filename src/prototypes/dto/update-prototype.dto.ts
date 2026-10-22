import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreatePrototypeDto } from './create-prototype.dto';

/**
 * Todos os campos são opcionais. `skipNullProperties: false` faz um campo
 * enviado como `null` ser validado (e rejeitado), em vez de ignorado.
 */
export class UpdatePrototypeDto extends PartialType(CreatePrototypeDto, {
  skipNullProperties: false,
}) {}

// Optional for compatibility with existing clients; supplied values protect
// against overwriting edits made after the client loaded the prototype.
export class VersionedUpdatePrototypeDto extends UpdatePrototypeDto {
  @ApiPropertyOptional({
    description: 'Version read by the client; mismatch responds with 409 Conflict.',
    minimum: 1,
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
