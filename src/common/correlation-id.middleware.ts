import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware global de Correlation-ID / Request-ID.
 *
 * Garante que toda requisição HTTP tenha um identificador único de rastreamento (Trace ID).
 * - Se o cliente já enviou `x-correlation-id` ou `x-request-id`, preserva o identificador.
 * - Caso contrário, gera um UUID v4 criptográfico.
 * - Propaga o cabeçalho `X-Correlation-ID` e `X-Request-ID` na resposta HTTP.
 * - Registra logs estruturados de entrada e saída com latência da requisição.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incomingId =
      (req.headers[CORRELATION_ID_HEADER] as string) ||
      (req.headers[REQUEST_ID_HEADER] as string) ||
      (req.headers[CORRELATION_ID_HEADER.toUpperCase()] as string) ||
      (req.headers[REQUEST_ID_HEADER.toUpperCase()] as string);

    const correlationId = incomingId && incomingId.trim() !== '' ? incomingId.trim() : randomUUID();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', correlationId);

    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const { statusCode } = res;
      const durationMs = Date.now() - start;
      this.logger.log(
        `[${correlationId}] ${method} ${originalUrl} -> ${statusCode} (${durationMs}ms)`,
      );
    });

    next();
  }
}
