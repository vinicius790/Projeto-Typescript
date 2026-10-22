import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface StructuredLogPayload {
  level: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export const structuredLogger = {
  info(payload: Record<string, unknown>, message?: string): void {
    const entry: StructuredLogPayload = {
      level: 'INFO',
      message: message ?? (typeof payload['message'] === 'string' ? payload['message'] : ''),
      timestamp: new Date().toISOString(),
      ...payload,
    };
    Logger.log(JSON.stringify(entry), 'StructuredLogger');
  },
  error(payload: Record<string, unknown>, message?: string): void {
    const entry: StructuredLogPayload = {
      level: 'ERROR',
      message: message ?? (typeof payload['message'] === 'string' ? payload['message'] : ''),
      timestamp: new Date().toISOString(),
      ...payload,
    };
    Logger.error(JSON.stringify(entry), 'StructuredLogger');
  },
  warn(payload: Record<string, unknown>, message?: string): void {
    const entry: StructuredLogPayload = {
      level: 'WARN',
      message: message ?? (typeof payload['message'] === 'string' ? payload['message'] : ''),
      timestamp: new Date().toISOString(),
      ...payload,
    };
    Logger.warn(JSON.stringify(entry), 'StructuredLogger');
  },
};

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const traceId = (req.headers['x-trace-id'] as string) || randomUUID();
  const spanId = (req.headers['x-span-id'] as string) || randomUUID();

  req.headers['x-trace-id'] = traceId;
  res.setHeader('X-Trace-Id', traceId);

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const responseTimeMs = seconds * 1000 + nanoseconds / 1e6;

    structuredLogger.info(
      {
        traceId,
        spanId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTimeMs: Number(responseTimeMs.toFixed(2)),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        context: 'HTTP_REQUEST',
      },
      'Incoming HTTP request completed',
    );
  });

  next();
}
