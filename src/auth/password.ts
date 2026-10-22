import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com `scrypt`, do módulo `crypto` do Node. O scrypt é lento e
 * consome memória de propósito, o que encarece ataques de força bruta; cada
 * senha recebe um "sal" aleatório, então senhas iguais geram hashes diferentes.
 *
 * Formato guardado no banco: `scrypt$<sal em hex>$<hash em hex>`.
 */
const SALT_BYTES = 16;
const KEY_BYTES = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

/** Devolve `false` (em vez de lançar erro) também quando o hash guardado é ilegível. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) {
    return false;
  }
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_BYTES) {
    return false;
  }
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return timingSafeEqual(actual, expected);
}
