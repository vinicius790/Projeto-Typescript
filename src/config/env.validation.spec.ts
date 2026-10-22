import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'file:./dev.db',
  JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
};

describe('validateEnv', () => {
  it('aplica os valores padrão quando só o obrigatório é informado', () => {
    const env = validateEnv(base);

    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_PROVIDER).toBe('sqlite');
    expect(env.DATABASE_URL).toBe('file:./dev.db');
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.JWT_REFRESH_TTL).toBe(604_800);
  });

  it('converte PORT de texto para número', () => {
    expect(validateEnv({ ...base, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['abc', '0', '70000', '80.5'])('rejeita PORT inválida: %s', (port) => {
    expect(() => validateEnv({ ...base, PORT: port })).toThrow('Variáveis de ambiente inválidas');
  });

  it('exige DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(
      'DATABASE_URL é obrigatória.',
    );
  });

  describe('banco de dados', () => {
    it('com SQLite (padrão), rejeita uma URL de PostgreSQL', () => {
      expect(() => validateEnv({ ...base, DATABASE_URL: 'postgresql://localhost/db' })).toThrow(
        'DATABASE_URL deve ser uma URL de sqlite, por exemplo "file:./dev.db".',
      );
    });

    it.each(['postgresql://usuario:senha@localhost:5432/banco', 'postgres://localhost/banco'])(
      'com DATABASE_PROVIDER=postgresql, aceita %s',
      (url) => {
        const env = validateEnv({ ...base, DATABASE_PROVIDER: 'postgresql', DATABASE_URL: url });

        expect(env.DATABASE_PROVIDER).toBe('postgresql');
        expect(env.DATABASE_URL).toBe(url);
      },
    );

    it('com DATABASE_PROVIDER=postgresql, rejeita uma URL de SQLite', () => {
      expect(() => validateEnv({ ...base, DATABASE_PROVIDER: 'postgresql' })).toThrow(
        'DATABASE_URL deve ser uma URL de postgresql',
      );
    });

    it('rejeita um banco não suportado', () => {
      expect(() => validateEnv({ ...base, DATABASE_PROVIDER: 'mysql' })).toThrow(
        'DATABASE_PROVIDER deve ser "sqlite" ou "postgresql".',
      );
    });
  });

  describe('JWT', () => {
    it('exige JWT_SECRET', () => {
      expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow('JWT_SECRET');
    });

    it('rejeita JWT_SECRET curto', () => {
      expect(() => validateEnv({ ...base, JWT_SECRET: 'curto' })).toThrow(
        'JWT_SECRET deve ter pelo menos 32 caracteres.',
      );
    });

    it('converte as validades de texto para número', () => {
      const env = validateEnv({ ...base, JWT_ACCESS_TTL: '300', JWT_REFRESH_TTL: '3600' });

      expect(env.JWT_ACCESS_TTL).toBe(300);
      expect(env.JWT_REFRESH_TTL).toBe(3600);
    });

    it.each(['0', '59', 'abc', '86401'])('rejeita JWT_ACCESS_TTL inválida: %s', (ttl) => {
      expect(() => validateEnv({ ...base, JWT_ACCESS_TTL: ttl })).toThrow('JWT_ACCESS_TTL');
    });
  });

  it('informa todos os problemas de uma vez', () => {
    const invalid = (): unknown => validateEnv({ PORT: '0' });

    expect(invalid).toThrow('PORT');
    expect(invalid).toThrow('DATABASE_URL');
    expect(invalid).toThrow('JWT_SECRET');
  });
});
