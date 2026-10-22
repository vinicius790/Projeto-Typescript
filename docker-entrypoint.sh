#!/usr/bin/env sh
set -e

# Garante que a pasta de dados persistente do SQLite existe
mkdir -p /app/data

# Se o banco SQLite ainda não possui schema ou se Prisma CLI estiver disponível, aplica as migrações
if [ -f "./node_modules/prisma/build/index.js" ]; then
    echo "[ENTRYPOINT] Sincronizando migrações com Prisma ($DATABASE_PROVIDER)..."
    node prisma/prisma-cli.mjs migrate deploy || true
fi

exec "$@"
