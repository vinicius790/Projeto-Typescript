import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * JWT (RFC 7519) assinado com HMAC-SHA256 (`HS256`), feito só com o módulo
 * `crypto` do Node: sem pacote externo. Um token são três partes em base64url
 * separadas por ponto: `cabeçalho.conteúdo.assinatura`.
 */

/** Campos que todo token emitido por `signJwt` carrega, além dos informados. */
export interface JwtClaims {
  /** Instante da emissão, em segundos desde 1970. */
  iat: number;
  /** Instante em que o token deixa de valer, em segundos desde 1970. */
  exp: number;
  [claim: string]: unknown;
}

export type JwtErrorReason = 'malformed' | 'signature' | 'expired';

export class JwtError extends Error {
  constructor(
    public readonly reason: JwtErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'JwtError';
  }
}

// O cabeçalho é sempre o mesmo, então a versão codificada também.
const HEADER = encode({ alg: 'HS256', typ: 'JWT' });

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(content: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(content).digest();
}

/**
 * Emite um token com o conteúdo informado, válido por `ttlSeconds`.
 *
 * @param now relógio em milissegundos; existe para os testes controlarem o tempo.
 */
export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): string {
  const iat = Math.floor(now / 1000);
  const content = `${HEADER}.${encode({ ...payload, iat, exp: iat + ttlSeconds })}`;
  return `${content}.${sign(content, secret).toString('base64url')}`;
}

/**
 * Confere a assinatura e a validade e devolve o conteúdo do token.
 *
 * A assinatura é conferida ANTES de o conteúdo ser interpretado, e o cabeçalho
 * tem de ser exatamente o de `HS256`: isso barra tokens com `alg: none` ou com
 * outro algoritmo escolhido por quem forjou o token.
 *
 * @throws JwtError com `reason` igual a `malformed`, `signature` ou `expired`.
 */
export function verifyJwt(token: string, secret: string, now: number = Date.now()): JwtClaims {
  const parts = token.split('.');
  const [header, body, signature] = parts;
  if (parts.length !== 3 || !header || !body || !signature) {
    throw new JwtError('malformed', 'Token malformado.');
  }
  if (header !== HEADER) {
    throw new JwtError('malformed', 'Cabeçalho do token não suportado.');
  }

  // Compara o TEXTO em base64url, não os bytes decodificados: o decodificador do
  // Node ignora caracteres inválidos e bits sobrando no último caractere, e assim
  // aceitaria várias grafias da mesma assinatura.
  const expected = Buffer.from(sign(`${header}.${body}`, secret).toString('base64url'));
  const received = Buffer.from(signature);
  // `timingSafeEqual` compara em tempo constante, mas exige tamanhos iguais.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new JwtError('signature', 'Assinatura do token inválida.');
  }

  const claims = parseClaims(body);
  if (claims.exp <= Math.floor(now / 1000)) {
    throw new JwtError('expired', 'Token expirado.');
  }
  return claims;
}

function parseClaims(body: string): JwtClaims {
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new JwtError('malformed', 'Conteúdo do token ilegível.');
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    typeof (claims as JwtClaims).iat !== 'number' ||
    typeof (claims as JwtClaims).exp !== 'number'
  ) {
    throw new JwtError('malformed', 'Conteúdo do token sem os campos obrigatórios.');
  }
  return claims as JwtClaims;
}
