import type { NextFunction, Request, Response } from 'express';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('gera novo UUID quando nenhum correlation-id é enviado', () => {
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/test',
    } as unknown as Request;

    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((key: string, val: string) => {
        headersSet[key] = val;
      }),
      on: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.correlationId).toBeDefined();
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(headersSet['X-Correlation-ID']).toBe(req.correlationId);
    expect(headersSet['X-Request-ID']).toBe(req.correlationId);
  });

  it('preserva correlation-id existente recebido nos headers', () => {
    const customId = 'trace-client-12345';
    const req = {
      headers: { 'x-correlation-id': customId },
      method: 'POST',
      originalUrl: '/checkout',
    } as unknown as Request;

    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((key: string, val: string) => {
        headersSet[key] = val;
      }),
      on: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe(customId);
    expect(headersSet['X-Correlation-ID']).toBe(customId);
    expect(headersSet['X-Request-ID']).toBe(customId);
  });

  it('suporta x-request-id como fallback se x-correlation-id não for passado', () => {
    const customId = 'request-abc-999';
    const req = {
      headers: { 'x-request-id': customId },
      method: 'GET',
      originalUrl: '/status',
    } as unknown as Request;

    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: jest.fn((key: string, val: string) => {
        headersSet[key] = val;
      }),
      on: jest.fn(),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe(customId);
  });
});
