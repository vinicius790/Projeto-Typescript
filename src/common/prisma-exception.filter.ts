import { ArgumentsHost, Catch, ConflictException, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/** Código do Prisma para "a operação dependia de um registro que não existe". */
const RECORD_NOT_FOUND = 'P2025';
/** Código do Prisma para "violação de índice único". */
const UNIQUE_CONSTRAINT = 'P2002';

/**
 * Traduz erros conhecidos do Prisma para respostas HTTP. Assim `update` e
 * `delete` de um id inexistente respondem 404 sem precisar de uma consulta
 * prévia (que ainda deixaria uma janela de corrida entre a checagem e a escrita),
 * e a gravação de um valor único repetido (o e-mail de um usuário) responde 409.
 *
 * Qualquer outro erro do Prisma segue para o tratamento padrão (500 + log).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  override catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    if (exception.code === RECORD_NOT_FOUND) {
      super.catch(new NotFoundException('Registro não encontrado.'), host);
      return;
    }
    if (exception.code === UNIQUE_CONSTRAINT) {
      super.catch(new ConflictException('Registro já existe.'), host);
      return;
    }
    super.catch(exception, host);
  }
}
