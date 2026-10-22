import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..');

/**
 * Prepara um banco descartável e aplica as migrações. As variáveis definidas
 * aqui são herdadas pelos processos de teste e pelo `global-teardown.ts`; o banco
 * configurado no `.env` nunca é usado.
 *
 * - Padrão: SQLite num arquivo temporário, FORA do repositório.
 * - Com `E2E_POSTGRES_URL` (ex.: `postgresql://usuario:senha@localhost:5432/banco`):
 *   PostgreSQL, num schema novo e exclusivo dentro desse banco, apagado no fim.
 *   O cliente do Prisma precisa ter sido gerado para PostgreSQL
 *   (`DATABASE_PROVIDER=postgresql npm run prisma:generate`).
 */
export default function globalSetup(): void {
  const postgresUrl = process.env.E2E_POSTGRES_URL;
  if (postgresUrl) {
    const schema = `e2e_${randomBytes(6).toString('hex')}`;
    const url = new URL(postgresUrl);
    url.searchParams.set('schema', schema);
    process.env.E2E_POSTGRES_SCHEMA = schema;
    process.env.DATABASE_PROVIDER = 'postgresql';
    process.env.DATABASE_URL = url.toString();
  } else {
    const directory = mkdtempSync(join(tmpdir(), 'prototype-api-e2e-'));
    process.env.E2E_DATABASE_DIR = directory;
    process.env.DATABASE_PROVIDER = 'sqlite';
    process.env.DATABASE_URL = `file:${join(directory, 'e2e.db').replaceAll('\\', '/')}`;
  }
  // Segredo só dos testes; não vale para nenhum outro ambiente.
  process.env.JWT_SECRET = 'segredo-usado-somente-nos-testes-e2e';
  process.env.JWT_ACCESS_TTL = '900';
  process.env.JWT_REFRESH_TTL = '604800';

  // O `prisma-cli.mjs` escolhe o schema do Prisma pelo DATABASE_PROVIDER acima.
  execSync('node prisma/prisma-cli.mjs migrate deploy', { cwd: root, stdio: 'inherit' });
}
