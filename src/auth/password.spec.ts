import { hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('gera um hash no formato scrypt$sal$hash, sem a senha em claro', async () => {
    const hash = await hashPassword('senha-secreta');

    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash.includes('senha-secreta')).toBe(false);
  });

  it('usa um sal aleatório: a mesma senha gera hashes diferentes', async () => {
    const first = await hashPassword('senha-secreta');
    const second = await hashPassword('senha-secreta');

    expect(first === second).toBe(false);
  });

  it('aceita a senha correta e recusa a errada', async () => {
    const hash = await hashPassword('senha-secreta');

    await expect(verifyPassword('senha-secreta', hash)).resolves.toBe(true);
    await expect(verifyPassword('senha-secretA', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it.each(['', 'texto-qualquer', 'bcrypt$aa$bb', 'scrypt$aa', 'scrypt$aa$bb'])(
    'recusa, sem lançar erro, o hash guardado ilegível "%s"',
    async (stored) => {
      await expect(verifyPassword('senha-secreta', stored)).resolves.toBe(false);
    },
  );
});
