import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/** Apaga o banco temporário criado em `global-setup.ts`. */
export default function globalTeardown(): void {
  const directory = process.env.E2E_DATABASE_DIR;
  if (directory) {
    rmSync(directory, { recursive: true, force: true });
  }
  const schema = process.env.E2E_POSTGRES_SCHEMA;
  // O nome foi gerado no setup (`e2e_` + hexadecimal), então pode ir direto no SQL.
  if (schema && /^e2e_[0-9a-f]+$/.test(schema)) {
    execSync('node prisma/prisma-cli.mjs db execute --stdin', {
      cwd: join(__dirname, '..'),
      input: `DROP SCHEMA "${schema}" CASCADE;`,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  }
}
