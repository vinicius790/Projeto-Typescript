# syntax=docker/dockerfile:1
# Multi-stage build otimizado para aplicação NestJS + Prisma com Node 22 Alpine

# ---------------------------------------------------------
# Estágio 1: Instalação das dependências completas
# ---------------------------------------------------------
FROM node:22-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --engine-strict=false

# ---------------------------------------------------------
# Estágio 2: Geração do Prisma Client e compilação NestJS
# ---------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig*.json nest-cli.json ./
COPY prisma ./prisma

# Gera o Prisma Client com binários do Alpine (musl)
RUN npx prisma generate --schema=prisma/schema.prisma

COPY src ./src
RUN npm run build

# Mantém apenas dependências de produção + CLI do Prisma para migrações no deploy
RUN npm prune --omit=dev --engine-strict=false && \
    npm install prisma@^6.19.3 --no-save --engine-strict=false

# ---------------------------------------------------------
# Estágio 3: Imagem final enxuta de produção (Runner)
# ---------------------------------------------------------
FROM node:22-alpine AS runner

LABEL maintainer="Erick <contato@erick.dev>" \
      description="NestJS + Prisma Design Patterns & Enterprise API em Node 22 Alpine" \
      version="2.3.0"

RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PROVIDER=sqlite \
    DATABASE_URL="file:/app/data/dev.db"

WORKDIR /app

# Cria diretório de persistência e ajusta permissões para usuário 'node'
RUN mkdir -p /app/data && chown -R node:node /app

COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

USER node

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/metrics?format=json').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
