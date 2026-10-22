import { createHmac } from 'node:crypto';
import { JwtError, signJwt, verifyJwt } from './jwt';

const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
const NOW = Date.UTC(2026, 0, 1);

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function reasonOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof JwtError ? error.reason : undefined;
  }
  return undefined;
}

describe('signJwt / verifyJwt', () => {
  it('emite um token de três partes com o cabeçalho HS256', () => {
    const [header, body, signature] = signJwt({ sub: '1' }, SECRET, 60, NOW).split('.');

    expect(header).toBe(encode({ alg: 'HS256', typ: 'JWT' }));
    expect(body).toBe(encode({ sub: '1', iat: NOW / 1000, exp: NOW / 1000 + 60 }));
    expect(signature).toMatch(/^[\w-]{43}$/);
  });

  it('gera a mesma assinatura que um HMAC-SHA256 feito à parte (interoperável)', () => {
    const token = signJwt({ sub: '1' }, SECRET, 60, NOW);
    const [header, body, signature] = token.split('.');

    const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');

    expect(signature).toBe(expected);
  });

  it('devolve o conteúdo de um token válido', () => {
    const token = signJwt({ sub: '7', role: 'ADMIN' }, SECRET, 60, NOW);

    expect(verifyJwt(token, SECRET, NOW + 59_000)).toEqual({
      sub: '7',
      role: 'ADMIN',
      iat: NOW / 1000,
      exp: NOW / 1000 + 60,
    });
  });

  it('recusa token expirado, inclusive no segundo exato da expiração', () => {
    const token = signJwt({ sub: '1' }, SECRET, 60, NOW);

    expect(reasonOf(() => verifyJwt(token, SECRET, NOW + 60_000))).toBe('expired');
    expect(reasonOf(() => verifyJwt(token, SECRET, NOW + 3_600_000))).toBe('expired');
  });

  it('recusa token assinado com outro segredo', () => {
    const token = signJwt({ sub: '1' }, 'outro-segredo-com-mais-de-32-caracteres', 60, NOW);

    expect(reasonOf(() => verifyJwt(token, SECRET, NOW))).toBe('signature');
  });

  it('recusa conteúdo adulterado mantendo a assinatura original', () => {
    const [header, , signature] = signJwt({ sub: '1', role: 'USER' }, SECRET, 60, NOW).split('.');
    const forged = encode({ sub: '1', role: 'ADMIN', iat: NOW / 1000, exp: NOW / 1000 + 60 });

    expect(reasonOf(() => verifyJwt(`${header}.${forged}.${signature}`, SECRET, NOW))).toBe(
      'signature',
    );
  });

  it('recusa o ataque "alg: none" e qualquer cabeçalho diferente de HS256', () => {
    const body = encode({ sub: '1', role: 'ADMIN', iat: NOW / 1000, exp: NOW / 1000 + 60 });
    const none = `${encode({ alg: 'none', typ: 'JWT' })}.${body}.`;
    const other = `${encode({ alg: 'HS512', typ: 'JWT' })}.${body}.abc`;

    expect(reasonOf(() => verifyJwt(none, SECRET, NOW))).toBe('malformed');
    expect(reasonOf(() => verifyJwt(other, SECRET, NOW))).toBe('malformed');
  });

  it.each(['', 'abc', 'a.b', 'a.b.c.d', '..'])('recusa o token malformado "%s"', (token) => {
    expect(reasonOf(() => verifyJwt(token, SECRET, NOW))).toBe('malformed');
  });

  it('recusa assinatura de tamanho errado sem lançar erro inesperado', () => {
    const [header, body] = signJwt({ sub: '1' }, SECRET, 60, NOW).split('.');

    expect(reasonOf(() => verifyJwt(`${header}.${body}.abc`, SECRET, NOW))).toBe('signature');
  });

  it('recusa outra grafia da mesma assinatura (bits sobrando no último caractere)', () => {
    const token = signJwt({ sub: '1' }, SECRET, 60, NOW);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(token.slice(-1));
    // O bit mais baixo do último caractere fica fora dos 32 bytes da assinatura.
    const variant = `${token.slice(0, -1)}${alphabet[last ^ 1]}`;

    expect(Buffer.from(variant.split('.')[2] ?? '', 'base64url')).toEqual(
      Buffer.from(token.split('.')[2] ?? '', 'base64url'),
    );
    expect(reasonOf(() => verifyJwt(variant, SECRET, NOW))).toBe('signature');
  });

  it('recusa conteúdo assinado corretamente, mas que não é um conjunto de claims', () => {
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const sign = (body: string): string => {
      const content = `${header}.${body}`;
      return `${content}.${createHmac('sha256', SECRET).update(content).digest('base64url')}`;
    };

    expect(reasonOf(() => verifyJwt(sign(encode({ sub: '1' })), SECRET, NOW))).toBe('malformed');
    expect(reasonOf(() => verifyJwt(sign('bm90LWpzb24'), SECRET, NOW))).toBe('malformed');
  });

  it('lança JwtError, com mensagem legível', () => {
    expect(() => verifyJwt('abc', SECRET)).toThrow(JwtError);
    expect(() => verifyJwt('abc', SECRET)).toThrow('Token malformado.');
  });
});
