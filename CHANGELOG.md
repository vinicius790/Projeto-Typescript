# Changelog

Todas as mudanças relevantes deste projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [2.3.0] - 2026-10-16

### Adicionado

- **Barramento de Eventos de Domínio Tipado (`TypedDomainEventBus`):**
  - Implementação tipada e assíncrona do padrão Observer para publicação e subscrição de eventos de domínio (`DomainEvent`).
  - Suporte a listeners específicos fortemente tipados e coringas (`subscribeAll`).
  - Histórico transacional em memória com limite configurável e isolamento total de falhas entre handlers.
  - Integração no ciclo de vida de Protótipos (`prototype.created`, `prototype.cloned`, `prototype.updated`, `prototype.deleted`, `prototype.restored`).
  - Endpoints REST para visualização e disparo demonstrativo: `GET /patterns/observer/events` e `POST /patterns/observer/publish`.
- **Motor de Multas Progressivas com Strategy Pattern (`ProgressiveFineStrategy`):**
  - Família de estratégias intercambiáveis de penalidades e juros moratórios: `LinearOverdueFineStrategy`, `TieredProgressiveFineStrategy` (faixas escalonadas com discriminação detalhada e agravamento por reincidência), `CompoundProgressiveFineStrategy` (juros compostos exponenciais) e `RegulatoryContractFineStrategy` (estrito Código de Defesa do Consumidor Art. 52 e juros moratórios legais do Código Civil).
  - Contexto dinâmico `ProgressiveFineContext` com métodos fábrica estáticos e alternância em tempo de execução.
  - Endpoints interativos: `POST /patterns/strategy/fines/calculate` e `GET /patterns/strategy/fines/strategies`.
- **Repositório Desacoplado com Paginação e Filtros Dinâmicos:**
  - Criação da camada `PrototypesRepository` (`IPrototypesRepository`) isolando o acesso a dados.
  - `PrototypeFilterDto` estendendo `PaginationQueryDto` com suporte a filtros combinados: busca parcial de nome (`name`), intervalos numéricos de `primitive` (`minPrimitive`, `maxPrimitive`), intervalos de datas ISO 8601 (`startDate`, `endDate`), presença de referências circulares (`hasCircular`) e ordenação dinâmica por múltiplos campos (`sortBy`, `sortOrder`).
- **Módulo de Observabilidade e Métricas (`MetricsModule`):**
  - Endpoint universal `GET /metrics` com suporte a formato Prometheus OpenMetrics (`text/plain`) e JSON estruturado (`?format=json` ou `Accept: application/json`).
  - Coleta automática de contadores HTTP, latência de rotas, consumo de memória V8 (Heap & RSS), uptime do processo e métricas de negócio (eventos de domínio e multas calculadas).
  - Interceptor global `MetricsInterceptor` para instrumentação transparente de requisições.
- **Dockerfile Multi-Stage Otimizado:**
  - Atualizado para Node.js 22 Alpine alinhado às engines do `package.json`.
  - Healthcheck automatizado apontando para `/metrics?format=json`.
  - Imagem de produção enxuta e segura executando com usuário não-root `node` e `dumb-init`.
- **Documentação de Arquitetura (`ARCHITECTURE.md`):**
  - Diagramas Mermaid completos: arquitetura em camadas, fluxo de eventos de domínio, matriz de classes do Strategy de multas, fluxo de dados do repositório dinâmico e pipeline de métricas.

## [2.2.0] - 2026-10-04

### Adicionado

- **Sessões revogáveis:** cada token de renovação tem um id (`jti`) gravado na tabela nova `RefreshToken`. O `/auth/refresh` faz rotação (revoga o token usado e emite outro na mesma sessão) e detecta reuso: um token já usado, se reapresentado, revoga a sessão inteira.
- `POST /auth/logout`: revoga a sessão do token de renovação informado (204; repetir não tem efeito).
- **Limite de tentativas de login:** 5 por IP + e-mail a cada 15 minutos; depois disso, **429** com o cabeçalho `Retry-After`. Sem pacote novo: a contagem fica na tabela nova `LoginAttempt`, com incremento atômico (`upsert`), e vale entre instâncias da API que usam o mesmo banco.
- **Administração de usuários** (só `ADMIN`): `GET /users` (paginado) e `PATCH /users/:id/role`, que recusa com 409 rebaixar o último `ADMIN`, inclusive com pedidos simultâneos.
- Testes e2e contra PostgreSQL com a variável `E2E_POSTGRES_URL` (schema descartável) e um job de CI com PostgreSQL 17.
- Migrações `20261003180000_refresh_tokens_first_admin` e `20261003210000_login_attempts`, para SQLite e PostgreSQL.
- Nas rotas com `@Roles`, o `JwtAuthGuard` confere o papel atual no banco: promover ou rebaixar alguém vale na hora. Trocar o papel também revoga todas as sessões do usuário.

### Corrigido

- Dois cadastros simultâneos num banco vazio podiam gerar dois `ADMIN`. Agora o primeiro ADMIN é gravado com `firstAdmin = true`, coluna de índice único, e quem perde a corrida vira `USER`.
- O JWT aceitava mais de uma grafia da mesma assinatura (bits sobrando no último caractere base64url); agora a comparação é pelo texto.
- `EventSubject` avisava em dobro a mesma função inscrita duas vezes.
- O corte de 160 caracteres do SMS podia partir um emoji ao meio.
- `prisma/prisma-cli.mjs` usava `shell: true`, que partia argumentos com espaço (`--name "nova coluna"`) e gerava o aviso DEP0190; agora chama o Prisma CLI com o próprio Node, sem shell.

### Alterado

- **Incompatível:** tokens de renovação emitidos pela 2.0.0 (sem `jti`) deixam de valer; é preciso entrar de novo.
- Os testes e2e aplicam as migrações por `prisma/prisma-cli.mjs`.

## [2.0.0] - 2026-10-02

### Adicionado

- **Cinco padrões de projeto novos** em `src/design-patterns/`, sem dependências, cada um com contrato genérico, implementação, exemplo executável e testes:
  - **Builder** (`Builder<T>`, `HttpRequestBuilder`, `BuilderValidationError` e as receitas `buildJsonPost`/`buildHealthCheck` no papel de Diretor);
  - **Factory Method** (`Creator<T>`, `Notifier` com `EmailNotifier`/`SmsNotifier` e `createNotifier`);
  - **Abstract Factory** (`AbstractFactory<Products>`, `FamilyFactory` e os temas `light`/`dark`);
  - **Observer** (`Observer<T>`, `Subject<T>`, `EventSubject`, `Thermostat` e `OverheatAlarm`);
  - **Strategy** (`Strategy<Input, Output>`, `StrategyContext` e os descontos do `Checkout`).
- `npm run examples` também executa os exemplos dos padrões novos (`src/design-patterns/examples.ts`).
- **Autenticação JWT própria** em `src/auth/`, sem pacote novo: JWT `HS256` assinado com HMAC-SHA256 do módulo `crypto` do Node, senhas com `scrypt` e sal aleatório, e as rotas `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` e `GET /auth/me`.
- **Papéis** `USER` e `ADMIN` (o primeiro usuário cadastrado vira `ADMIN`), com o `JwtAuthGuard` e os decoradores `@Roles()` e `@CurrentUser()`.
- Modelo `User` no Prisma e a migração `20261002180000_users`.
- **Suporte opcional a PostgreSQL** pela variável `DATABASE_PROVIDER` (`sqlite`, o padrão, ou `postgresql`), com o schema `prisma/postgres/schema.prisma`, as migrações em `prisma/postgres/migrations/` e o `prisma/prisma-cli.mjs`, que escolhe o schema certo.
- Variáveis de ambiente `DATABASE_PROVIDER`, `JWT_SECRET`, `JWT_ACCESS_TTL` e `JWT_REFRESH_TTL`, todas validadas na inicialização.
- `PrismaExceptionFilter` traduz violação de valor único (`P2002`) em 409.
- Swagger com autenticação Bearer (botão **Authorize**).
- Testes unitários dos padrões novos, do JWT, do hash de senha, do `AuthService` e do `JwtAuthGuard`; testes e2e da autenticação e das regras de acesso.

### Alterado

- **Incompatível:** as rotas de escrita de `/prototypes` (`POST`, `PATCH`, `DELETE`, `POST /:id/clone` e `POST /from-template/:key`) exigem `Authorization: Bearer <token de acesso>`; `DELETE` exige o papel `ADMIN`. A leitura continua pública.
- **Incompatível:** `JWT_SECRET` (32 caracteres ou mais) passou a ser obrigatória; sem ela a API não sobe.
- A validação de `DATABASE_URL` depende do banco escolhido e todas as falhas do ambiente são informadas de uma vez.
- Os scripts `prisma:generate`, `prisma:migrate` e `prisma:deploy` passam pelo `prisma/prisma-cli.mjs`.
- Os testes e2e rodam um arquivo por vez (`maxWorkers: 1`), porque compartilham o banco temporário.

## [1.0.0] - 2026-10-01

### Adicionado

- Biblioteca do padrão Prototype (`src/prototype-pattern/`): `Prototype<T>`, `shallowClone`, `deepClone` com referência circular, `Cloneable` e `PrototypeRegistry`, com exemplos executáveis.
- API REST em NestJS + Prisma + SQLite para criar, listar, alterar, apagar e clonar protótipos, com catálogo de modelos, paginação, validação e documentação OpenAPI.
