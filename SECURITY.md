# Segurança

## Relatar uma vulnerabilidade

Caso identifique qualquer falha de segurança na API ou nas dependências, reporte de forma privada pela aba **Security → Report a vulnerability** no repositório GitHub.

Por favor, forneça:
- Endpoint, método HTTP e parâmetros envolvidos.
- Passos ou script curl para reprodução do comportamento inesperado.
- Severidade estimada e possíveis vetores de exploração.

## Modelo e arquitetura de segurança da API

O **Projeto-Typescript** é uma aplicação backend estruturada com NestJS e TypeScript:
- **Validação estrita de DTOs**: todas as requisições que chegam aos controllers passam por validação via `ValidationPipe` (`class-validator` e `class-transformer`) com `whitelist: true` e `forbidNonWhitelisted: true`, prevenindo poluição de parâmetros e injeção de propriedades maliciosas.
- **Camada de persistência segura**: consultas à base de dados (SQLite) utilizam mapeadores ORM com consultas parametrizadas, prevenindo injeções de SQL.
- **Isolamento de credenciais**: strings de conexão, chaves secretas e portas são geridas estritamente através do `@nestjs/config` e variáveis de ambiente em `.env`, devidamente excluídas do controle de versão.
- **Ocultação de detalhes internos em produção**: respostas de erro HTTP (exceções 500) não expõem *stack traces* nem metadados internos de infraestrutura ao cliente externo.

## Boas práticas para colaboradores

- Nunca versionar arquivos `.env`, chaves `.pem`, certificados ou dumps de banco `*.db`.
- Execute `npm audit` e linter de segurança (`eslint`) antes de submeter alterações.
