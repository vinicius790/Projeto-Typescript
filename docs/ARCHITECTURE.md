# Arquitetura do Sistema e Modelo de Dados

Este documento especifica a arquitetura técnica, os diagramas C4 (Contexto, Contêineres e Componentes), o Modelo Entidade-Relacionamento (ERD) e os mecanismos de escalabilidade e concorrência do **Projeto TypeScript**.

---

## 1. Visão Geral e Diagramas C4

A arquitetura do sistema adota os princípios de separação de responsabilidades (SoC), arquitetura em camadas modular com **NestJS**, desacoplamento de banco de dados via **Prisma ORM** e implementação de padrões de projeto GoF clássicos (com destaque para o *Prototype Pattern* com suporte a referências circulares e linhagem).

### 1.1 C4 Nível 1: Diagrama de Contexto de Sistema

Exibe os atores externos e os limites do sistema.

```mermaid
flowchart TD
    subgraph Users["Atores Externos"]
        AdminUser["Administrador / DevOps<br/>[Role: ADMIN]"]
        StandardUser["Desenvolvedor / Consumidor<br/>[Role: USER]"]
        ClientApp["Aplicações Clientes / SPAs<br/>[HTTP / REST Client]"]
    end

    subgraph SystemBoundary["Fronteira da Solução"]
        ApiPlatform["<b>Prototype & Design Patterns API</b><br/><i>(NestJS + TypeScript)</i><br/>Serviços REST, Autenticação JWT, Catálogo e Engine de Protótipos"]
    end

    subgraph StorageBoundary["Camada de Persistência"]
        DatabaseEngine["<b>Banco de Dados Relacional</b><br/><i>SQLite (Dev/Test) ou PostgreSQL (Prod)</i><br/>Armazenamento ACID, Histórico Imutável e Sessões"]
    end

    AdminUser -->|"Gerencia usuários, roles e inspeciona auditoria (HTTPS/JWT)"| ApiPlatform
    StandardUser -->|"Cria, clona, edita e versiona protótipos (HTTPS/JWT)"| ApiPlatform
    ClientApp -->|"Consome endpoints REST e especificações OpenAPI"| ApiPlatform
    ApiPlatform -->|"Leitura e escrita transacional via Prisma Client"| DatabaseEngine
```

---

### 1.2 C4 Nível 2: Diagrama de Contêineres

Detelha as aplicações executáveis, armazenamento e fronteiras de comunicação.

```mermaid
flowchart TB
    subgraph ClientLayer["Camada Cliente"]
        Browser["Navegador / Swagger UI / API Client"]
    end

    subgraph AppContainer["Contêiner da Aplicação (NestJS / Node.js 24+)"]
        HttpServer["HTTP Server (Express Adapter)"]
        AuthGuard["JWT Auth Guard & Rate Limiter"]
        RestRouter["Controllers REST (Prototypes, Auth, Users)"]
        DomainServices["Domain Services & Patterns Registry"]
        OrmLayer["Prisma Client Engine"]
    end

    subgraph DbContainer["Contêiner de Armazenamento"]
        RelationalDb[("Relational Database<br/>SQLite (local) / PostgreSQL (cluster)<br/>Schema Unificado")]
    end

    Browser -->|"Requisições REST / JSON (Porta 3000)"| HttpServer
    HttpServer --> AuthGuard
    AuthGuard -->|"Requisição Autenticada / Validada"| RestRouter
    RestRouter --> DomainServices
    DomainServices --> OrmLayer
    OrmLayer -->|"Driver TCP / IPC (SQL Dialect)"| RelationalDb
```

---

### 1.3 C4 Nível 3: Diagrama de Componentes

Mapeia a organização interna dos módulos NestJS e o subsistema de padrões de design.

```mermaid
flowchart TD
    subgraph Ingress["Camada de Entrada & Segurança"]
        JwtGuard["JwtAuthGuard<br/>(Valida access token & roles)"]
        RateLimiter["LoginRateLimiter<br/>(Tabela LoginAttempt com TTL)"]
        ExceptionFilter["PrismaExceptionFilter<br/>(Mapeamento de códigos P2002/P2025 para HTTP)"]
    end

    subgraph Controllers["Controladores REST"]
        AuthController["AuthController<br/>/auth/login, /auth/register, /auth/refresh"]
        PrototypesController["PrototypesController<br/>/prototypes, /prototypes/:id/clone, /revisions"]
        UsersController["UsersController<br/>/users, /users/:id/role"]
    end

    subgraph Services["Serviços de Domínio"]
        AuthService["AuthService<br/>(Hashing scrypt, emissão de JWT e rotação de refresh)"]
        PrototypesService["PrototypesService<br/>(Clone deep, OCC via version, lineage e snapshots)"]
        UsersService["UsersService<br/>(Gestão de credenciais e primeiro admin atômico)"]
        PrismaService["PrismaService<br/>(Gerenciamento de conexões e transações)"]
    end

    subgraph PatternEngine["Design Patterns Subsystem"]
        ProtoEngine["Prototype Pattern Engine<br/>(Cloneable, Registry, Deep Clone com CircularRef)"]
        BuilderPattern["Builder Pattern<br/>(HttpRequestBuilder)"]
        FactoryPattern["Factory & Abstract Factory<br/>(Notifiers & Theme Widgets)"]
        BehavioralPatterns["Observer & Strategy<br/>(EventSubject / Discounts)"]
    end

    JwtGuard --> Controllers
    RateLimiter --> AuthController
    AuthController --> AuthService
    PrototypesController --> PrototypesService
    UsersController --> UsersService

    PrototypesService --> ProtoEngine
    PrototypesService --> PrismaService
    AuthService --> PrismaService
    UsersService --> PrismaService

    PrismaService --> ExceptionFilter
```

---

## 2. Diagrama Entidade-Relacionamento (ERD)

O esquema relacional é mantido pelo Prisma e sincronizado de forma idêntica entre **SQLite** e **PostgreSQL**.

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : "emite sessões"
    USER ||--o{ PROTOTYPE_REVISION : "registra como autor"
    PROTOTYPE ||--o| CIRCULAR_REFERENCE : "possui relação 1:1"
    PROTOTYPE ||--o{ PROTOTYPE_REVISION : "histórico de versões"
    PROTOTYPE ||--o{ PROTOTYPE : "clonado a partir de (linhagem)"
    
    USER {
        int id PK "Autoincrement"
        string email UK "E-mail único do usuário"
        string passwordHash "Hash scrypt com salt aleatório"
        string role "Papel RBAC: ADMIN ou USER"
        boolean firstAdmin UK "true apenas no 1º admin criado; null nos demais"
        datetime createdAt "Timestamp de criação"
        datetime updatedAt "Timestamp da última alteração"
    }

    REFRESH_TOKEN {
        string id PK "Identificador único (jti do JWT)"
        string familyId "Identificador da família de renovação"
        int userId FK "Referência a USER(id) ON DELETE CASCADE"
        datetime expiresAt "Data e hora de expiração"
        datetime revokedAt "Data de revogação (detecção de reuso)"
        datetime createdAt "Timestamp de emissão"
    }

    LOGIN_ATTEMPT {
        string key PK "Chave combinada: IP + E-mail"
        int attempts "Contador de tentativas na janela"
        datetime resetAt "Timestamp de expiração da janela (15 min)"
    }

    PROTOTYPE {
        int id PK "Autoincrement"
        string name "Nome identificador do protótipo"
        int primitive "Campo numérico primitivo do modelo"
        datetime component "Objeto temporal associado"
        int version "Versão inteira para Controle Otimista (OCC)"
        int clonedFromId FK "Auto-referência: id do protótipo pai"
        datetime createdAt "Timestamp de criação"
        datetime updatedAt "Timestamp de atualização"
    }

    CIRCULAR_REFERENCE {
        int id PK "Autoincrement"
        string label "Rótulo do nó com link de volta"
        int prototypeId UK, FK "Chave estrangeira 1:1 para PROTOTYPE(id)"
    }

    PROTOTYPE_REVISION {
        int id PK "Autoincrement"
        int prototypeId FK "Referência a PROTOTYPE(id) ON DELETE CASCADE"
        int version "Número da versão do snapshot"
        string name "Snapshot do nome"
        int primitive "Snapshot do campo primitivo"
        datetime component "Snapshot do componente"
        string circularReferenceLabel "Snapshot do label circular"
        int actorId FK "Usuário autor da revisão (USER.id)"
        datetime recordedAt "Timestamp imutável do snapshot"
    }
```

---

## 3. Padrões de Dados e Resiliência

### 3.1 Controle Otimista de Concorrência (OCC)
Para suportar múltiplas instâncias da API sem deadlocks em nível de linha:
- O campo `version` em `Prototype` é incrementado a cada mutação (`UPDATE prototypes SET version = version + 1 WHERE id = :id AND version = :expectedVersion`).
- Caso o número de linhas afetadas seja `0`, a aplicação detecta conflito de edição concorrente e retorna `409 Conflict`, orientando o cliente a recarregar o estado mais recente.

### 3.2 Imutabilidade e Event Sourcing (Audit Trail)
- Cada alteração em um `Prototype` (criação, edição, clone ou restauração) gera uma linha em `PrototypeRevision`.
- O par `(prototypeId, version)` possui restrição de unicidade (`@@unique([prototypeId, version])`), garantindo que o histórico nunca retroceda nem sobrescreva registros prévios.
- O campo `actorId` preserva a rastreabilidade (quem executou a operação), mantendo-se nulo (`ON DELETE SET NULL`) caso o usuário venha a ser excluído.

### 3.3 Sessões Distribuídas e Rotação de Tokens
- **Refresh Token Rotation (RTR):** A cada chamada para `/auth/refresh`, o token apresentado é marcado com `revokedAt = now()`, e um novo token é gerado com o mesmo `familyId`.
- **Detecção de Replay:** Se um token já revogado for reapresentado, o sistema assume comprometimento de credencial e revoga imediatamente todos os tokens associados àquele `familyId`.

### 3.4 Rate Limiting Distribuído e Proteção Anti-Força-Bruta
- A tabela `LoginAttempt` armazena a chave composta `IP:email` e a data de reset.
- Por residir no banco de dados com índice em `resetAt`, a proteção é horizontalmente compartilhada entre nós da API sem exigir dependência rígida de instâncias de cache volátil em configurações mínimas.
