# Guia de Contribuição — Padrões de Projeto em TypeScript 📐

Agradecemos o seu interesse em contribuir com este repositório de estudo avançado e implementação de Design Patterns em TypeScript com NestJS e Prisma!

---

## 🛠️ Boas Práticas e Diretrizes Técnicas

1. **Separação de Camadas**:
   - As implementações dos padrões GoF (Prototype, Builder, Factory Method, Abstract Factory, Observer, Strategy) em `src/prototype-pattern/` e `src/design-patterns/` devem permanecer **puras e sem dependências externas**.
   - A API NestJS em `src/prototypes/`, `src/auth/` e `src/users/` consome esses padrões e lida com persistência, segurança e validação.
2. **Tipagem Estrita**:
   - TypeScript configurado em modo strict. Evite o uso de `any`; declare tipos genéricos e interfaces precisas.
3. **Segurança & Boas Práticas**:
   - Senhas sempre com hash scrypt. Tokens JWT com rotação e família de refresh tokens.
4. **Testes Automatizados**:
   - Qualquer padrão ou rota adicionada deve possuir testes unitários e de integração (`npm test`).

---

## 📋 Padrão de Commits (Conventional Commits)

Seguimos a especificação [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```text
<tipo>(<escopo>): <descrição no imperativo>
```

### Exemplos:
- `feat(patterns): implementa padrao Decorator com tipagem generica`
- `fix(auth): invalida familia de refresh token em caso de reuso suspeito`
- `docs(readme): adiciona diagrama mermaid para Abstract Factory`
- `test(prototype): adiciona verificacao de referencia circular profunda`
- `refactor(prisma): otimiza consulta de historico de revisoes`

---

## 🚀 Como Submeter um Pull Request

1. **Fork e Branch**:
   ```bash
   git checkout -b feat/novo-padrao-ou-ajuste
   ```
2. **Executar Testes e Qualidade**:
   ```bash
   npm test
   npm run lint
   ```
   Garanta que a suíte de testes (unitários, integração e e2e) seja aprovada com 100% de sucesso.
3. **Commit Semântico**:
   ```bash
   git commit -m "feat(patterns): adiciona implementacao do padrao State"
   ```
4. **Abrir Pull Request**:
   - Forneça detalhes da implementação e exemplos de uso do padrão adicionado ou rota modificada.
