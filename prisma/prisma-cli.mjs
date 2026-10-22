// Encaminha um comando ao Prisma CLI usando o schema do banco escolhido em
// DATABASE_PROVIDER ("sqlite", o padrão, ou "postgresql").
// Uso: node prisma/prisma-cli.mjs <comando do prisma> [argumentos]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SCHEMAS = {
  sqlite: 'prisma/schema.prisma',
  postgresql: 'prisma/postgres/schema.prisma',
};

try {
  // Variáveis já definidas no ambiente têm prioridade sobre as do arquivo.
  process.loadEnvFile('.env');
} catch {
  // Sem arquivo .env: vale só o que estiver no ambiente.
}

const provider = process.env.DATABASE_PROVIDER || 'sqlite';
const schema = Object.hasOwn(SCHEMAS, provider) ? SCHEMAS[provider] : undefined;
if (!schema) {
  console.error(`DATABASE_PROVIDER inválido: "${provider}". Use "sqlite" ou "postgresql".`);
  process.exit(1);
}

// Roda o Prisma CLI instalado com o próprio Node, sem shell: assim funciona igual
// no Windows e os argumentos chegam intactos (`--name "nova coluna"`, por exemplo).
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const args = [...process.argv.slice(2), '--schema', schema];
const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
