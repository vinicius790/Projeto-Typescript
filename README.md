# Padrões de projeto em TypeScript

Projeto de estudo de padrões de projeto, com foco no **Prototype**, em três partes:

1. **Uma biblioteca pequena e sem dependências** (`src/prototype-pattern/`) com interface genérica, cópia rasa, cópia profunda (com referência circular, `Date`, `Map`, `Set` e instâncias de classe) e um registro de protótipos.
2. **Mais nove padrões GoF**, também sem dependências (`src/design-patterns/`): Builder, Factory Method, Abstract Factory, Observer, Strategy, Adapter, Decorator, Chain of Responsibility e State.
3. **Uma API REST corporativa** em NestJS + Prisma (`src/prototypes/` e `src/design-patterns/`), com SQLite por padrão ou PostgreSQL, middleware global de Correlation-ID/Request-ID para rastreabilidade de requisições, CRUD auditado de protótipos, endpoints demonstrativos para os padrões Adapter, Decorator, Chain of Responsibility e State, e autenticação JWT própria (`src/auth/`) com sessões revogáveis, limite de tentativas de login e administração de papéis (`src/users/`).

## Sumário

- [O padrão Prototype](#o-padrão-prototype)
- [A biblioteca](#a-biblioteca)
- [Outros padrões de projeto](#outros-padrões-de-projeto)
- [A API](#a-api)
- [Como rodar](#como-rodar)
- [Testes e qualidade](#testes-e-qualidade)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Limitações conhecidas](#limitações-conhecidas)

## O padrão Prototype

Prototype é um padrão criacional: em vez de montar um objeto do zero (`new` + configuração), você **copia um objeto que já existe**. O objeto sabe se copiar por meio de um método `clone()`, então quem pede a cópia não precisa conhecer a classe concreta nem os detalhes internos.

Vale a pena quando:

- montar o objeto é caro ou trabalhoso e já existe um parecido pronto;
- o código só conhece o objeto por uma interface, sem saber a classe concreta;
- existe um conjunto de configurações "de fábrica" a partir das quais novos objetos nascem (o registro de protótipos).

```mermaid
classDiagram
    class Prototype~T~ {
        <<interface>>
        +clone() T
    }
    class Cloneable {
        <<abstract>>
        +clone() this
        +shallowClone() this
    }
    class PrototypeRegistry~T~ {
        -prototypes Map
        +register(key, prototype) this
        +unregister(key) boolean
        +has(key) boolean
        +keys() string[]
        +create(key) T
    }
    class PrototypeModel {
        +name string
        +primitive number
        +component Date
        +circularReference BackReference
    }
    class BackReference {
        +label string
        +owner PrototypeModel
    }
    Prototype <|.. Cloneable
    Cloneable <|-- PrototypeModel
    PrototypeRegistry o-- Prototype : guarda e clona
    PrototypeModel *-- BackReference
    BackReference --> PrototypeModel : referência de volta
```

### Cópia rasa x cópia profunda

|                                     | Cópia rasa (`shallowClone`)             | Cópia profunda (`deepClone`)     |
| ----------------------------------- | --------------------------------------- | -------------------------------- |
| Objeto de primeiro nível            | novo                                    | novo                             |
| Objetos aninhados                   | **compartilhados** com o original       | copiados                         |
| Alterar um objeto aninhado da cópia | altera o original também                | não afeta o original             |
| Custo                               | proporcional ao primeiro nível          | proporcional ao grafo inteiro    |
| Quando usar                         | o aninhado é imutável ou é de propósito | a cópia precisa ser independente |

### Referência circular

Um objeto pode apontar para outro que aponta de volta para ele. Uma cópia profunda ingênua entra em recursão infinita; uma cópia mal feita deixa o componente da cópia apontando para o objeto **original**.

```mermaid
flowchart LR
    subgraph Original
        P1[protótipo] -- circularReference --> C1[componente]
        C1 -- referência de volta --> P1
    end
    subgraph Clone
        P2[protótipo] -- circularReference --> C2[componente]
        C2 -- referência de volta --> P2
    end
    P1 -. "clone()" .-> P2
```

`deepClone` resolve isso com uma tabela (`WeakMap`) de "original → cópia": cada objeto é registrado **antes** de suas propriedades serem percorridas. Quando o percurso volta a um objeto já visto, ele reaproveita a cópia que já existe. O mesmo mecanismo mantém referências compartilhadas como compartilhadas dentro da cópia.

### Por que não lodash nem `structuredClone`?

A versão original usava `lodash.cloneDeep`. Ele foi removido: a biblioteca não tem dependências.

O `structuredClone` nativo trata ciclos, `Date`, `Map` e `Set`, mas **descarta a classe do objeto** (devolve um objeto simples, sem os métodos) e lança erro se encontrar uma função. Para o padrão Prototype isso não serve: o clone de um `Documento` precisa continuar sendo um `Documento`. Por isso a cópia profunda é uma implementação própria, de cerca de 70 linhas, em [`src/prototype-pattern/clone.ts`](src/prototype-pattern/clone.ts). O `structuredClone` é usado só onde ele basta: dados binários (`ArrayBuffer` e typed arrays).

## A biblioteca

Tudo é exportado por `src/prototype-pattern/index.ts`.

| Item                     | O que faz                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| `Prototype<T>`           | Interface do padrão: `clone(): T`.                                        |
| `shallowClone(valor)`    | Cópia rasa. Preserva a classe, getters e propriedades não enumeráveis.    |
| `deepClone(valor)`       | Cópia profunda, com suporte a ciclos.                                     |
| `Cloneable`              | Classe base opcional com `clone()` (profunda) e `shallowClone()` prontos. |
| `PrototypeRegistry<T>`   | Catálogo de protótipos por chave; `create(chave)` devolve um clone novo.  |
| `PrototypeNotFoundError` | Erro lançado por `create` quando a chave não está registrada.             |

O que `deepClone` trata:

- valores primitivos (devolvidos como estão);
- objetos literais e instâncias de classe (a cadeia de protótipos é preservada);
- `Date`, `RegExp` (com `flags` e `lastIndex`), `Map`, `Set`, arrays (inclusive esparsos), `ArrayBuffer`, typed arrays e `Buffer` do Node;
- chaves `Symbol`, getters/setters e propriedades não enumeráveis;
- referências circulares e referências compartilhadas;
- funções, `WeakMap`, `WeakSet`, `WeakRef` e `Promise` são mantidos **por referência**, porque não há como copiá-los.

### Exemplo de uso

```ts
import { Cloneable, PrototypeRegistry } from './prototype-pattern';

class Documento extends Cloneable {
  constructor(
    public titulo: string,
    public autor: { nome: string },
    public criadoEm: Date,
  ) {
    super();
  }
}

const original = new Documento('Relatório', { nome: 'Ana' }, new Date());

const rasa = original.shallowClone();
rasa.autor.nome = 'Bruno'; // altera original.autor também: o objeto é o mesmo

const profunda = original.clone();
profunda.autor.nome = 'Carla'; // original.autor continua 'Bruno'

const catalogo = new PrototypeRegistry<Documento>().register('relatorio', original);
const novo = catalogo.create('relatorio'); // um Documento novo, independente
```

### Exemplos executáveis

Há três exemplos em `src/prototype-pattern/examples/` (cópia rasa x profunda, referência circular e registro). Importar esses arquivos não executa nada; eles só rodam quando chamados:

```bash
npm run examples
```

Saída:

```text
--- Cópia rasa x cópia profunda ---
Autor do original após editar a cópia rasa: Bruno
Autor da cópia profunda: Carla
Cópia rasa compartilha o autor com o original: true
Cópia profunda compartilha o autor com o original: false
Tags do original: typescript
Tags da cópia profunda: typescript, prototype
A cópia profunda continua sendo um Article: true
--- Referência circular ---
OK: o valor primitivo foi levado para o clone.
OK: o componente (Date) foi clonado, não compartilhado.
OK: o componente com referência de volta foi clonado.
OK: a referência de volta do clone aponta para o próprio clone.
--- Registro de protótipos ---
Chaves registradas: quadrado-azul, faixa-vermelha
Primeiro clone: quadrado azul de 10x10
Segundo clone, personalizado: quadrado verde de 25x10
Novo clone após a personalização: quadrado azul de 10x10
Chave desconhecida: Nenhum protótipo registrado com a chave "triângulo".
```

## Outros padrões de projeto

Além do Prototype, a pasta `src/design-patterns/` implementa padrões GoF fundamentais, no mesmo formato: um **contrato genérico** (interface), uma **implementação concreta** com um caso de uso realista, um **exemplo executável** e **testes**. Nenhum deles tem dependências; tudo é exportado por `src/design-patterns/index.ts`.

| Padrão                   | Tipo           | Contrato genérico                            | Caso de uso                                         |
| ------------------------ | -------------- | -------------------------------------------- | --------------------------------------------------- |
| Builder                  | criacional     | `Builder<T>`                                 | montar uma requisição HTTP passo a passo            |
| Factory Method           | criacional     | `Creator<T>`                                 | notificações por e-mail ou SMS                      |
| Abstract Factory         | criacional     | `AbstractFactory<Products>`                  | widgets de interface de um mesmo tema               |
| Observer                 | comportamental | `Observer<T>`, `Subject<T>`                  | termostato que avisa um alarme e um histórico       |
| Strategy                 | comportamental | `Strategy<Input, Output>`, `StrategyContext` | descontos intercambiáveis no caixa de uma loja      |
| Adapter                  | estrutural     | `PaymentProcessor`                           | gateway de pagamento fictício com múltiplos provedores |
| Decorator                | estrutural     | `OrderService`, `OrderServiceDecorator`      | logging, telemetria de performance e cache de serviços |
| Chain of Responsibility  | comportamental | `TransactionHandler`                         | pipeline sequencial de autorização financeira/agendamento |
| State                    | comportamental | `OrderState`, `OrderContext`                 | máquina de estados para ciclo de vida de ordens/serviços |


### Builder

Monta um objeto complexo em etapas, com métodos encadeáveis, e só entrega o produto em `build()`. Toda a validação fica em `build()`, que informa **todos** os problemas de uma vez (`BuilderValidationError`); o produto sai congelado (`Object.freeze`). As funções `buildJsonPost` e `buildHealthCheck` fazem o papel do **Diretor**: receitas prontas que escondem a sequência de passos.

```mermaid
classDiagram
    class Builder~T~ {
        <<interface>>
        +build() T
    }
    class HttpRequestBuilder {
        +setMethod(method) this
        +setUrl(url) this
        +addHeader(name, value) this
        +addQuery(name, value) this
        +setJsonBody(payload) this
        +setTimeout(ms) this
        +build() HttpRequest
    }
    class HttpRequest {
        <<readonly>>
        +method
        +url
        +headers
        +body
        +timeoutMs
    }
    class Diretor {
        <<funções>>
        +buildJsonPost(url, payload)
        +buildHealthCheck(url)
    }
    Builder <|.. HttpRequestBuilder
    HttpRequestBuilder ..> HttpRequest : cria
    Diretor ..> HttpRequestBuilder : usa
```

```ts
const request = new HttpRequestBuilder('https://api.exemplo.com/produtos')
  .addQuery('categoria', 'livros')
  .addHeader('Accept', 'application/json')
  .setTimeout(5_000)
  .build(); // ou lança BuilderValidationError com a lista de problemas
```

### Factory Method

A classe base (`Notifier`) tem a lógica comum (`notify`), mas deixa para as subclasses o **método de fábrica** `create()`, que decide qual transporte concreto instanciar. Um canal novo é uma subclasse nova; `notify` não muda. `createNotifier(canal, destino)` escolhe a subclasse em tempo de execução.

```mermaid
classDiagram
    class Creator~T~ {
        <<interface>>
        +create() T
    }
    class Transport {
        <<interface>>
        +channel string
        +deliver(message) string
    }
    class Notifier {
        <<abstract>>
        +sent string[]
        +create()* Transport
        +notify(message) string
    }
    class EmailNotifier {
        +create() Transport
    }
    class SmsNotifier {
        +create() Transport
    }
    Creator <|.. Notifier
    Notifier <|-- EmailNotifier
    Notifier <|-- SmsNotifier
    EmailNotifier ..> EmailTransport : cria
    SmsNotifier ..> SmsTransport : cria
    Transport <|.. EmailTransport
    Transport <|.. SmsTransport
```

### Abstract Factory

Uma fábrica produz uma **família** de produtos que combinam entre si. `FamilyFactory<Products>` é a implementação genérica: recebe uma receita por produto, e o compilador exige que **todas** existam, então uma família nunca fica incompleta. `create('button')` já devolve o tipo certo (`Button`). O cliente (`renderLoginForm`) recebe só a fábrica abstrata, o que torna impossível misturar temas.

```mermaid
classDiagram
    class AbstractFactory~Products~ {
        <<interface>>
        +create(kind) Products[kind]
    }
    class FamilyFactory~Products~ {
        -makers ProductMakers
        +create(kind) Products[kind]
        +kinds() string[]
    }
    class Button {
        <<interface>>
        +render(label) string
    }
    class Checkbox {
        <<interface>>
        +render(label, checked) string
    }
    AbstractFactory <|.. FamilyFactory
    FamilyFactory ..> Button : light ou dark
    FamilyFactory ..> Checkbox : light ou dark
    Button <|.. LightButton
    Button <|.. DarkButton
    Checkbox <|.. LightCheckbox
    Checkbox <|.. DarkCheckbox
    renderLoginForm ..> AbstractFactory : só conhece a interface
```

### Observer

O padrão Observer é implementado em dois níveis de granularidade:
1. **Contrato Puro GoF (`EventSubject<T>`):** O sujeito mantém uma lista de observadores e avisa todos quando algo acontece, sem saber quem são. `EventSubject<T>` aceita objetos `Observer<T>` ou funções simples, e `subscribe` devolve a função que cancela a inscrição; inscrever o mesmo objeto ou a mesma função de novo não duplica os avisos.
2. **Barramento de Eventos de Domínio (`TypedDomainEventBus`):** Um barramento assíncrono fortemente tipado (`src/design-patterns/observer/domain-event-bus.ts`) que orquestra eventos da aplicação (`prototype.created`, `prototype.cloned`, `prototype.updated`, `prototype.deleted`, `fine.calculated`, etc.). Suporta listeners específicos, ouvintes wildcard (`subscribeAll`), retenção de histórico em memória e isolamento completo de falhas entre ouvintes.

```mermaid
sequenceDiagram
    participant Svc as PrototypesService
    participant Bus as TypedDomainEventBus
    participant Obs as Observers Específicos
    participant Wild as Wildcard Listeners (MetricsService)

    Svc->>Bus: publishSync("prototype.created", payload)
    Bus->>Obs: handler(event)
    Bus->>Wild: wildcardHandler(event)
    Note over Bus: Armazena no histórico em memória
```

### Strategy

O padrão Strategy define uma família de algoritmos intercambiáveis com a mesma entrada e saída, trocáveis em tempo de execução:
1. **Descontos em Vendas (`Checkout`):** Calcula descontos sem condicionais (`NoDiscount`, `PercentageDiscount`, `BulkDiscount`, `FixedDiscount`).
2. **Cálculo de Multas Progressivas (`ProgressiveFineContext`):** Motor de cálculo moratório e penalidades contratuais (`src/design-patterns/strategy/progressive-fine.ts`):
   - **`LinearOverdueFineStrategy`:** Multa base fixa inicial (2%) + percentual diário linear (0.1%/dia) com teto legal.
   - **`TieredProgressiveFineStrategy`:** Faixas escalonadas progressivas por dias de atraso (1-15d: 0.1%/dia, 16-30d: 0.25%/dia, 31-60d: 0.4%/dia, >60d: 0.6%/dia), com agravamento por reincidência e discriminação analítica de cada faixa.
   - **`CompoundProgressiveFineStrategy`:** Juros moratórios compostos diários exponenciais.
   - **`RegulatoryContractFineStrategy`:** Alinhada estritamente com o Código de Defesa do Consumidor (Art. 52, multa máxima de 2%) e juros moratórios legais do Código Civil (1% ao mês pro rata die).

```mermaid
classDiagram
    class Strategy~Input, Output~ {
        <<interface>>
        +execute(input) Output
    }
    class ProgressiveFineContext {
        -ProgressiveFineStrategy strategy
        +calculate(input) ProgressiveFineResult
        +switchStrategy(strategy) this
    }
    class LinearOverdueFineStrategy {
        +execute(input) ProgressiveFineResult
    }
    class TieredProgressiveFineStrategy {
        +execute(input) ProgressiveFineResult
    }
    class CompoundProgressiveFineStrategy {
        +execute(input) ProgressiveFineResult
    }
    class RegulatoryContractFineStrategy {
        +execute(input) ProgressiveFineResult
    }
    ProgressiveFineContext o-- Strategy
    Strategy <|.. LinearOverdueFineStrategy
    Strategy <|.. TieredProgressiveFineStrategy
    Strategy <|.. CompoundProgressiveFineStrategy
    Strategy <|.. RegulatoryContractFineStrategy
```



### Adapter

Converte a interface incompatível de SDKs proprietários ou serviços externos em uma interface uniforme (`PaymentProcessor`) consumida pela aplicação. O cliente interage exclusivamente com a interface alvo, enquanto os adapters traduzem formatos de valores (centavos inteiros, floats ou strings decimais), nomes de campos (`orderId` vs `reference_id` vs `external_reference`) e respostas de status.

```mermaid
classDiagram
    class PaymentProcessor {
        <<interface>>
        +provider string
        +processPayment(request) Promise~PaymentResult~
        +refund(transactionId, amount) Promise~PaymentRefundResult~
    }
    class StripePaymentAdapter {
        -stripeApi StripeExternalApi
        +processPayment(request) Promise~PaymentResult~
        +refund(transactionId, amount) Promise~PaymentRefundResult~
    }
    class PayPalPaymentAdapter {
        -payPalApi PayPalExternalApi
        +processPayment(request) Promise~PaymentResult~
        +refund(transactionId, amount) Promise~PaymentRefundResult~
    }
    class MercadoPagoPaymentAdapter {
        -mpApi MercadoPagoExternalApi
        +processPayment(request) Promise~PaymentResult~
        +refund(transactionId, amount) Promise~PaymentRefundResult~
    }
    class PaymentProcessorFactory {
        <<factory>>
        +create(provider) PaymentProcessor
        +getSupportedProviders() string[]
    }
    PaymentProcessor <|.. StripePaymentAdapter
    PaymentProcessor <|.. PayPalPaymentAdapter
    PaymentProcessor <|.. MercadoPagoPaymentAdapter
    PaymentProcessorFactory ..> PaymentProcessor : instancia
```

```ts
const processor = PaymentProcessorFactory.create('stripe');
const result = await processor.processPayment({
  orderId: 'PED-1234',
  amountInCents: 15000,
  currency: 'BRL',
  customerEmail: 'cliente@exemplo.com',
});
```

### Decorator

Agrega dinamicamente responsabilidades a um serviço (`OrderService`) sem alterar sua implementação base (`BaseOrderService`) nem recorrer a herança rígida. Múltiplos decorators podem ser encadeados em pipeline:

1. **`LoggingOrderServiceDecorator`**: registra entrada, parâmetros, tempo de processamento e desfecho de cada operação;
2. **`PerformanceOrderServiceDecorator`**: computa telemetria em alta precisão (`performance.now`), calculando média, latência mínima, máxima e contagem de chamadas lentas;
3. **`CachingOrderServiceDecorator`**: armazena consultas em memória com TTL e invalidação automática em escritas.

```mermaid
classDiagram
    class OrderService {
        <<interface>>
        +createOrder(dto) Promise~Order~
        +getOrderById(id) Promise~Order~
        +listOrders() Promise~Order[]~
    }
    class BaseOrderService {
        -orders Map
        +createOrder(dto) Promise~Order~
        +getOrderById(id) Promise~Order~
        +listOrders() Promise~Order[]~
    }
    class OrderServiceDecorator {
        <<abstract>>
        #inner OrderService
        +createOrder(dto) Promise~Order~
        +getOrderById(id) Promise~Order~
        +listOrders() Promise~Order[]~
    }
    class LoggingOrderServiceDecorator {
        -logs string[]
        +getCapturedLogs() string[]
    }
    class PerformanceOrderServiceDecorator {
        -metrics Map
        +getMetrics() Record
    }
    class CachingOrderServiceDecorator {
        -cache Map
        +getStats() CacheStats
    }
    OrderService <|.. BaseOrderService
    OrderService <|.. OrderServiceDecorator
    OrderServiceDecorator <|-- LoggingOrderServiceDecorator
    OrderServiceDecorator <|-- PerformanceOrderServiceDecorator
    OrderServiceDecorator <|-- CachingOrderServiceDecorator
```

```ts
// Composição transparente em camadas:
const base = new BaseOrderService();
const cached = new CachingOrderServiceDecorator(base, 60_000);
const monitored = new PerformanceOrderServiceDecorator(cached);
const service = new LoggingOrderServiceDecorator(monitored);

const order = await service.createOrder({ customerEmail: 'dev@corp.com', items: [{ name: 'Curso', quantity: 1, unitPrice: 200 }] });
```

### Chain of Responsibility

Evita o acoplamento do remetente de uma requisição ao seu destinatário, dando a mais de um objeto a oportunidade de tratar a requisição. Os objetos receptores são encadeados e a requisição passa ao longo da esteira até que um deles a processe, aprove ou a interrompa precocemente (*short-circuit*).

No projeto, o padrão é aplicado em nível empresarial em `src/design-patterns/chain-of-responsibility/` para **autorização de transações financeiras e agendamentos**:
1. **`BalanceCheckHandler`**: confere se a conta possui provisão suficiente para honrar a cobrança;
2. **`FraudCheckHandler`**: avalia o escore de risco (`customerRiskScore`), bloqueando scores críticos (>= 85) ou retendo para mesa de análise manual (>= 70);
3. **`DailyLimitCheckHandler`**: calcula o volume acumulado diário e rejeita transações que estourem o teto contratual;
4. **`FinalApprovalHandler`**: gera o código de liquidação formal (`AUTH-XXXX-YYYY`) e aprova a operação.

#### 1. Diagrama de Fluxo da Esteira (Flowchart)

```mermaid
flowchart TD
    Req([Transação / Agendamento]) --> B[BalanceCheckHandler: Checagem de Saldo]
    B -->|Saldo Insuficiente| R1[Rejeitado: Saldo Insuficiente]
    B -->|Saldo Suficiente| F[FraudCheckHandler: Análise Antifraude]
    F -->|Score >= 85| R2[Rejeitado: Risco Crítico de Fraude]
    F -->|Score >= 70| M[Retido: Mesa Manual de Auditoria]
    F -->|Score Seguro < 70| L[DailyLimitCheckHandler: Limite Diário]
    L -->|Gasto > Limite| R3[Rejeitado: Teto Diário Excedido]
    L -->|Dentro do Limite| A[FinalApprovalHandler: Autorização Final]
    A --> OK([Autorizado: AUTH Code Gerado])
```

#### 2. Diagrama de Classes (ClassDiagram)

```mermaid
classDiagram
    class TransactionHandler {
        <<interface>>
        +setNext(handler: TransactionHandler) TransactionHandler
        +handle(request: TransactionRequest, context?: PipelineExecutionContext) Promise~TransactionAuthorizationResult~
    }
    class BaseTransactionHandler {
        <<abstract>>
        #nextHandler: TransactionHandler
        +setNext(handler) TransactionHandler
        +handle(request, context) Promise
        #process(request, context)* Promise
        #recordStep(context, passed, message, details)
        #delegateNext(request, context) Promise
    }
    class BalanceCheckHandler {
        +name: "BalanceCheckHandler"
        #process(request, context) Promise
    }
    class FraudCheckHandler {
        +name: "FraudCheckHandler"
        #process(request, context) Promise
    }
    class DailyLimitCheckHandler {
        +name: "DailyLimitCheckHandler"
        #process(request, context) Promise
    }
    class FinalApprovalHandler {
        +name: "FinalApprovalHandler"
        #process(request, context) Promise
    }
    class TransactionPipeline {
        <<factory>>
        +builder() TransactionPipelineBuilder
        +createFinancialAuthorizationChain() TransactionHandler
        +createSchedulingAuthorizationChain() TransactionHandler
    }

    TransactionHandler <|.. BaseTransactionHandler
    BaseTransactionHandler <|-- BalanceCheckHandler
    BaseTransactionHandler <|-- FraudCheckHandler
    BaseTransactionHandler <|-- DailyLimitCheckHandler
    BaseTransactionHandler <|-- FinalApprovalHandler
    BaseTransactionHandler o-- TransactionHandler : nextHandler
    TransactionPipeline ..> TransactionHandler : instancia esteiras
```

```ts
// Exemplo de uso da Chain of Responsibility:
const chain = TransactionPipeline.createFinancialAuthorizationChain();

const result = await chain.handle({
  transactionId: 'TX-2026-001',
  accountId: 'ACC-8831',
  amountInCents: 15000, // R$ 150,00
  currency: 'BRL',
  accountBalanceInCents: 50000,
  dailyLimitInCents: 100000,
  dailySpentInCents: 20000,
  customerRiskScore: 12,
});

if (result.authorized) {
  console.log(`Aprovado! Código: ${result.authorizationCode}`);
} else {
  console.log(`Rejeitado pelo elo: ${result.reason}`);
}
```

### State

Permite que um objeto (`OrderContext`) altere seu comportamento dinamicamente quando seu estado interno muda. O padrão substitui condicionais espalhadas e inconsistentes (`switch (status)`) por classes de estado coesas em `src/design-patterns/state/` que encapsulam as regras de negócio, as ações autorizadas e as transições válidas no ciclo de vida de uma ordem ou agendamento de serviço.

Estados modelados:
1. **`Criado`** (`CreatedState`): Estado inicial. Permite submeter para faturamento (`submitForPayment`) ou cancelar (`cancel`).
2. **`AguardandoPagamento`** (`AwaitingPaymentState`): Aguarda liquidação. Permite confirmar pagamento (`confirmPayment`) ou cancelar (`cancel`).
3. **`Processando`** (`ProcessingState`): Pagamento confirmado, ordem em atendimento ou execução. Permite atribuir operador (`startProcessing`), concluir (`complete`) ou cancelar com estorno (`cancel`).
4. **`Concluido`** (`CompletedState`): Estado terminal. O serviço foi realizado e entregue com êxito. Nenhuma ação subsequente é admitida.
5. **`Cancelado`** (`CancelledState`): Estado terminal. A ordem foi revogada. Não aceita novas ações ou reativação.

Qualquer tentativa de disparar uma ação ilegal para o estado atual lança de imediato `InvalidStateTransitionException`.

#### 1. Fluxo de Transição de Estados (State Machine)

```mermaid
flowchart TD
    Criado([1. Criado]) -->|"submitForPayment(metodo)"| AguardandoPagamento[2. AguardandoPagamento]
    Criado -->|"cancel(motivo)"| Cancelado([5. Cancelado - Terminal])
    
    AguardandoPagamento -->|"confirmPayment(transactionId)"| Processando[3. Processando]
    AguardandoPagamento -->|"cancel(motivo)"| Cancelado
    
    Processando -->|"complete(notas)"| Concluido([4. Concluido - Terminal])
    Processando -->|"cancel(motivo / estorno)"| Cancelado
```

#### 2. Diagrama de Classes do State Pattern (ClassDiagram)

```mermaid
classDiagram
    class OrderState {
        <<interface>>
        +name OrderStatusName
        +getAllowedActions() string[]
        +submitForPayment(context, method) Promise
        +confirmPayment(context, txId) Promise
        +startProcessing(context, opId) Promise
        +complete(context, notes) Promise
        +cancel(context, reason) Promise
    }
    class BaseOrderState {
        <<abstract>>
        +name OrderStatusName
        +getAllowedActions()* string[]
    }
    class CreatedState {
        +name: "Criado"
        +getAllowedActions() ['submitForPayment', 'cancel']
    }
    class AwaitingPaymentState {
        +name: "AguardandoPagamento"
        +getAllowedActions() ['confirmPayment', 'cancel']
    }
    class ProcessingState {
        +name: "Processando"
        +getAllowedActions() ['startProcessing', 'complete', 'cancel']
    }
    class CompletedState {
        +name: "Concluido"
        +getAllowedActions() []
    }
    class CancelledState {
        +name: "Cancelado"
        +getAllowedActions() []
    }
    class OrderContext {
        -currentState OrderState
        -data OrderData
        -history StateTransitionRecord[]
        +transitionTo(nextState, action, reason) void
        +submitForPayment(method) Promise
        +confirmPayment(txId) Promise
        +startProcessing(operatorId) Promise
        +complete(notes) Promise
        +cancel(reason) Promise
        +getStateName() OrderStatusName
        +getAllowedActions() string[]
        +getHistory() StateTransitionRecord[]
        +toJSON() OrderStateSnapshot
    }

    OrderState <|.. BaseOrderState
    BaseOrderState <|-- CreatedState
    BaseOrderState <|-- AwaitingPaymentState
    BaseOrderState <|-- ProcessingState
    BaseOrderState <|-- CompletedState
    BaseOrderState <|-- CancelledState
    OrderContext o-- OrderState : estado corrente
```

```ts
// Exemplo de uso do State Pattern:
const order = new OrderContext({
  customerName: 'Renato Souza',
  serviceName: 'Corte + Barboterapia',
  amountInCents: 9500,
});

await order.submitForPayment('PIX');      // Transição: Criado -> AguardandoPagamento
await order.confirmPayment('TX-987654');   // Transição: AguardandoPagamento -> Processando
await order.complete('Finalizado!');      // Transição: Processando -> Concluido

// Se tentar cancelar agora que está concluído:
// Lança InvalidStateTransitionException: Ação inválida 'cancel' para o estado atual 'Concluido'.
```

### Saída dos exemplos novos

`npm run examples` roda os exemplos do Prototype e, em seguida, os dos nove padrões GoF (`src/design-patterns/examples.ts`):

```text
--- Builder ---
Passo a passo: GET https://api.exemplo.com/produtos?categoria=livros&pagina=2 (limite de 5000 ms)
Receita pronta: POST https://api.exemplo.com/produtos com corpo {"nome":"Caderno"}
Cabeçalhos da receita: accept, content-type
O produto é imutável: true
Montagem recusada: URL inválida: "endereço inválido"; requisição GET não pode ter corpo
--- Factory Method ---
Canal email: [email para ana@exemplo.com] Seu pedido saiu para entrega.
Canal sms: [sms para +55 11 90000-0000] Seu pedido saiu para entrega.
O SMS corta o excedente: 160 letras
Cada create() devolve um transporte novo: true
--- Abstract Factory ---
Tema light: [ ] Lembrar de mim | [ Entrar ]
Tema dark: (#) Lembrar de mim | [# Entrar #]
Produtos da fábrica dark: button, checkbox
Todos os produtos da fábrica dark são do tema dark: true
--- Observer ---
Histórico até o cancelamento da inscrição: 22, 35
Alertas do alarme: ALERTA: 35 °C passa do limite de 30 °C
Observadores ainda inscritos: 1
--- Strategy ---
Sem desconto: 200
Com 10% de desconto: 180
Com atacado (15% a partir de 10 itens): 170
Com cupom de R$ 50: 150
Ordem crescente: 1, 2, 3
Ordem decrescente: 3, 2, 1
--- Adapter ---
[Stripe] Transação: ch_x9a2b8 | Status: PAID | Taxa: 465 centavos
[PayPal] Transação: CAP-7K3N9L | Status: PAID | Taxa: 550 centavos
[MercadoPago] Transação: 48920194 | Status: PAID | Taxa: 149 centavos
--- Decorator ---
[LOG] Iniciando createOrder para cliente="arquiteto@empresa.com" com 2 itens.
[LOG] createOrder concluído com sucesso: ID=ord_7fa2, total=R$6200 (1ms).
[LOG] Buscando pedido ID="ord_7fa2".
Estatísticas de Cache: 1 hits, 1 misses (tamanho: 1)
Métricas de Performance: getOrderById chamadas=2, média=0.45ms
```

## A API

### Modelo de dados

```mermaid
erDiagram
    User ||--o{ RefreshToken : "sessões"
    User o|--o{ PrototypeRevision : "autor opcional"
    Prototype ||--o| CircularReference : "tem (1:1 opcional)"
    Prototype ||--o{ PrototypeRevision : "histórico imutável"
    Prototype |o--o{ Prototype : "clonedFrom / clones"
    Prototype {
        Int id PK
        String name
        Int primitive
        DateTime component
        DateTime createdAt
        DateTime updatedAt
        Int version "cresce em cada alteração"
        Int clonedFromId FK "nulo se não é clone"
    }
    CircularReference {
        Int id PK
        String label
        Int prototypeId FK "único"
    }
    User {
        Int id PK
        String email "único, em minúsculas"
        String passwordHash "scrypt"
        String role "USER ou ADMIN"
        Boolean firstAdmin "único; true só no primeiro ADMIN"
        DateTime createdAt
        DateTime updatedAt
    }
    RefreshToken {
        String id PK "jti do token"
        String familyId "sessão"
        Int userId FK
        DateTime expiresAt
        DateTime revokedAt "nulo enquanto vale"
        DateTime createdAt
    }
    LoginAttempt {
        String key PK "IP + e-mail"
        Int attempts
        DateTime resetAt "fim da janela"
    }
    PrototypeRevision {
        Int id PK
        Int prototypeId FK
        Int version "única por protótipo"
        String name
        Int primitive
        DateTime component
        String circularReferenceLabel "nulo sem componente"
        Int actorId FK "nulo para estado anterior à migração"
        DateTime recordedAt
    }
```

- Apagar um protótipo apaga o seu `CircularReference` (`onDelete: Cascade`).
- Apagar um protótipo **não** apaga os clones dele; o `clonedFromId` dos clones passa a ser `null` (`onDelete: SetNull`).
- `User` é independente dos protótipos: guarda quem pode escrever na API.
- `RefreshToken` guarda cada token de renovação emitido, para poder revogá-lo; apagar um usuário apaga os tokens dele (`onDelete: Cascade`).
- `LoginAttempt` conta as tentativas de login de cada IP + e-mail na janela atual; as janelas vencidas são apagadas a cada tentativa.
- `PrototypeRevision` guarda snapshots do estado inicial e de cada alteração. Restaurar uma revisão cria outra versão; apagar o protótipo apaga seu histórico. As migrações preservam o estado dos registros existentes como revisão 1.

### Endpoints

| Método   | Rota                             | O que faz                                                                    | Acesso        | Sucesso | Erros              |
| -------- | -------------------------------- | ---------------------------------------------------------------------------- | ------------- | ------- | ------------------ |
| `POST`   | `/prototypes`                    | Cria um protótipo (dispara evento `prototype.created` no EventBus).           | token         | 201     | 400, 401           |
| `GET`    | `/prototypes`                    | Lista com paginação e filtros dinâmicos (`name`, `dates`, `primitive`, etc). | público       | 200     | 400                |
| `GET`    | `/prototypes/templates`          | Lista os modelos do catálogo.                                                | público       | 200     |                    |
| `POST`   | `/prototypes/from-template/:key` | Cria um protótipo clonando um modelo do catálogo.                            | token         | 201     | 400, 401, 404      |
| `GET`    | `/prototypes/:id`                | Busca por id.                                                                | público       | 200     | 400, 404           |
| `PATCH`  | `/prototypes/:id`                | Atualiza parcialmente (dispara evento `prototype.updated`).                   | token         | 200     | 400, 401, 404, 409 |
| `DELETE` | `/prototypes/:id`                | Remove (dispara evento `prototype.deleted`).                                 | token `ADMIN` | 204     | 400, 401, 403, 404 |
| `POST`   | `/prototypes/:id/clone`          | Clona um protótipo existente (dispara evento `prototype.cloned`).             | token         | 201     | 400, 401, 404      |
| `GET`    | `/prototypes/:id/revisions`      | Lista snapshots em ordem de versão.                                          | público       | 200     | 400, 404           |
| `POST`   | `/prototypes/:id/revisions/:version/restore` | Restaura snapshot como nova versão (`prototype.restored`).       | token         | 200     | 400, 401, 404, 409 |
| `GET`    | `/metrics`                       | Exporta métricas nos formatos **Prometheus** (text/plain) ou **JSON**.       | público       | 200     |                    |

#### Parâmetros de Filtro e Paginação Dinâmica (`GET /prototypes`):
- `page` (int, default 1) e `limit` (int, default 10, max 100): Paginação padrão.
- `name` (string): Busca textual parcial case-insensitive no nome do protótipo.
- `minPrimitive` / `maxPrimitive` (int): Intervalo fechado de inteiros de 32 bits.
- `startDate` / `endDate` (ISO 8601): Intervalo de datas do componente.
- `hasCircular` (boolean): Filtra protótipos que possuem (`true`) ou não possuem (`false`) referência circular.
- `sortBy` (`id` | `name` | `primitive` | `component` | `createdAt` | `version`): Campo de ordenação.
- `sortOrder` (`asc` | `desc`): Direção da ordenação.

```bash
# Exemplo de consulta avançada com filtros dinâmicos:
curl "http://localhost:3000/prototypes?name=relat&minPrimitive=50&hasCircular=true&sortBy=name&sortOrder=asc"
```

### Endpoints de Demonstração de Padrões GoF (`/patterns`)

| Método | Rota                               | O que faz                                                     | Acesso  | Sucesso | Erros    |
| ------ | ---------------------------------- | ------------------------------------------------------------- | ------- | ------- | -------- |
| `GET`  | `/patterns/catalog`                | Catálogo de todos os 10 padrões GoF implementados no projeto. | público | 200     |          |
| `POST` | `/patterns/strategy/fines/calculate` | Calcula multas progressivas com Strategy Pattern.           | público | 200     | 400      |
| `GET`  | `/patterns/strategy/fines/strategies` | Lista as estratégias de multa progressiva disponíveis.      | público | 200     |          |
| `GET`  | `/patterns/observer/events`        | Consulta histórico de eventos no TypedDomainEventBus.         | público | 200     |          |
| `POST` | `/patterns/observer/publish`       | Publica evento de teste no TypedDomainEventBus.               | público | 200     | 400      |
| `POST` | `/patterns/adapter/pay`            | Processa pagamento via Adapter (Stripe, PayPal, Mercado Pago).| público | 200     | 400      |
| `GET`  | `/patterns/adapter/providers`      | Lista provedores suportados pelo padrão Adapter.              | público | 200     |          |
| `POST` | `/patterns/decorator/order`        | Cria pedido decorado com Logging, Performance e Cache.        | público | 201     | 400      |
| `GET`  | `/patterns/decorator/orders`       | Lista pedidos com telemetria acumulada dos decorators.        | público | 200     |          |
| `GET`  | `/patterns/decorator/order/:id`    | Consulta pedido demonstrando cache hit/miss decorado.         | público | 200     |          |
| `GET`  | `/patterns/decorator/metrics`      | Retorna métricas analíticas e estatísticas de cache.          | público | 200     |          |
| `POST` | `/patterns/chain/authorize`        | Executa esteira sequencial de autorização com short-circuit.  | público | 200     | 400      |
| `GET`  | `/patterns/chain/pipeline`         | Descreve os elos das esteiras financeira e de agendamento.   | público | 200     |          |
| `POST` | `/patterns/state/orders`           | Cria nova ordem gerenciada pela máquina de estados (Criado).  | público | 201     | 400      |
| `GET`  | `/patterns/state/orders`           | Lista todas as ordens e seus estados comportamentais atuais.  | público | 200     |          |
| `GET`  | `/patterns/state/orders/:id`       | Consulta ordem, ações permitidas e histórico de transições.   | público | 200     | 404      |
| `POST` | `/patterns/state/orders/:id/transition` | Dispara ação de transição de estado na ordem especificada.| público | 200     | 400, 404 |

#### Exemplo de Payload - Adapter (`POST /patterns/adapter/pay`):

```json
{
  "provider": "stripe",
  "orderId": "PED-2026-99",
  "amountInCents": 19900,
  "currency": "BRL",
  "customerEmail": "comprador@exemplo.com"
}
```

```bash
# Executando via cURL com Correlation-ID customizado:
curl -X POST http://localhost:3000/patterns/adapter/pay \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: meu-rastreio-123" \
  -d '{"provider":"mercadopago","orderId":"PED-55","amountInCents":9900,"currency":"BRL","customerEmail":"cli@exemplo.com"}'
```

#### Exemplo de Payload - Decorator (`POST /patterns/decorator/order`):

```json
{
  "customerEmail": "techlead@enterprise.com",
  "items": [
    { "name": "Assinatura Pro", "quantity": 1, "unitPrice": 149.9 },
    { "name": "Setup Consultoria", "quantity": 2, "unitPrice": 450.0 }
  ]
}
```

#### Exemplo de Payload - Chain of Responsibility (`POST /patterns/chain/authorize`):

```json
{
  "accountId": "ACC-54912",
  "amountInCents": 15000,
  "currency": "BRL",
  "accountBalanceInCents": 60000,
  "dailyLimitInCents": 100000,
  "dailySpentInCents": 20000,
  "customerRiskScore": 12,
  "pipelineType": "financial"
}
```

```bash
# Executando autorização via cURL:
curl -X POST http://localhost:3000/patterns/chain/authorize \
  -H "Content-Type: application/json" \
  -d '{"accountId":"ACC-54912","amountInCents":15000,"currency":"BRL","accountBalanceInCents":60000,"dailyLimitInCents":100000,"dailySpentInCents":20000,"customerRiskScore":12,"pipelineType":"financial"}'
```

#### Exemplo de Payloads - State Pattern (`POST /patterns/state/orders` & `/transition`):

```json
// 1. Criar ordem (nasce no estado 'Criado')
POST /patterns/state/orders
{
  "customerName": "Rodrigo Medeiros",
  "serviceName": "Corte Degradê Navalhado + Barba Terapia",
  "amountInCents": 8500
}

// 2. Transitar estado (ex: submit_payment, confirm_payment, start_processing, complete, cancel)
POST /patterns/state/orders/ORD-DEMO-001/transition
{
  "action": "submit_payment",
  "paymentMethod": "PIX"
}
```

```bash
# Confirmando pagamento da ordem:
curl -X POST http://localhost:3000/patterns/state/orders/ORD-DEMO-001/transition \
  -H "Content-Type: application/json" \
  -d '{"action":"confirm_payment","transactionId":"TX-PIX-998877"}'
```

### Rastreabilidade Global com Correlation-ID / Request-ID

Toda requisição HTTP recebida pela API passa pelo `CorrelationIdMiddleware` (`src/common/correlation-id.middleware.ts`):

1. **Detecção e propagação:** confere os cabeçalhos `x-correlation-id` ou `x-request-id` (case-insensitive). Se não existirem, gera um identificador único via `crypto.randomUUID()`;
2. **Injeção no ciclo de vida:** anexa o ID em `req.correlationId` e adiciona os cabeçalhos de resposta `X-Correlation-ID` e `X-Request-ID`;
3. **Structured Logging:** ao concluir a requisição (`res.on('finish')`), emite log contextualizado com o ID da requisição, verbo HTTP, rota, código de status e tempo de resposta em milissegundos:

```text
[HTTP] [a1b2c3d4-e5f6-7890-abcd-ef1234567890] POST /patterns/adapter/pay -> 200 (4ms)
[HTTP] [a1b2c3d4-e5f6-7890-abcd-ef1234567890] GET /patterns/decorator/metrics -> 200 (1ms)
```

### Observabilidade e Métricas (`/metrics`)

A aplicação conta com o `MetricsModule` (`src/metrics/`), que provê instrumentação em tempo real de latência, contadores HTTP e métricas de negócio expostas no endpoint universal `GET /metrics`.

O endpoint suporta dois formatos de entrega:
1. **Padrão Prometheus OpenMetrics (`text/plain; version=0.0.4`):** Formato textual padrão utilizado por scrapers do Prometheus, Datadog ou Grafana Agent:
   ```text
   # HELP process_uptime_seconds Tempo de atividade do processo em segundos.
   # TYPE process_uptime_seconds gauge
   process_uptime_seconds 42
   # HELP process_resident_memory_bytes Memória residente (RSS) utilizada pelo processo Node.js.
   # TYPE process_resident_memory_bytes gauge
   process_resident_memory_bytes 58720256
   # HELP http_requests_total Total de requisições HTTP recebidas por método, rota e código de status.
   # TYPE http_requests_total counter
   http_requests_total{method="GET",path="/prototypes",status="200"} 12
   # HELP domain_events_published_total Total de eventos de domínio publicados no EventBus.
   # TYPE domain_events_published_total counter
   domain_events_published_total{event="prototype.created"} 5
   ```
2. **Formato JSON Estruturado (`?format=json` ou `Accept: application/json`):** Ideal para dashboards web e ferramentas de monitoramento leve:
   ```bash
   curl "http://localhost:3000/metrics?format=json"
   ```

A documentação interativa (Swagger UI) fica em `http://localhost:3000/docs` e o documento OpenAPI em `http://localhost:3000/docs-json`.

### Autenticação e papéis

A leitura (`GET`) é pública. **Toda escrita exige um token de acesso**, e apagar exige o papel `ADMIN`. A autenticação é própria, sem pacote externo: o JWT é assinado com HMAC-SHA256 pelo módulo `crypto` do Node (`src/auth/jwt.ts`) e as senhas são guardadas com `scrypt` e sal aleatório (`src/auth/password.ts`).

| Método | Rota             | O que faz                                           | Sucesso | Erros         |
| ------ | ---------------- | --------------------------------------------------- | ------- | ------------- |
| `POST` | `/auth/register` | Cadastra `{ email, password }` e devolve os tokens. | 201     | 400, 409      |
| `POST` | `/auth/login`    | Autentica e devolve os tokens.                      | 200     | 400, 401, 429 |
| `POST` | `/auth/refresh`  | Troca `{ refreshToken }` por um novo par de tokens. | 200     | 400, 401      |
| `POST` | `/auth/logout`   | Encerra a sessão do `{ refreshToken }`.             | 204     | 400, 401      |
| `GET`  | `/auth/me`       | Devolve o usuário do token de acesso.               | 200     | 401           |

- **Dois tokens.** O de **acesso** (15 minutos por padrão) vai em `Authorization: Bearer <token>`. O de **renovação** (7 dias) só serve em `/auth/refresh`. O campo `typ` do token impede usar um no lugar do outro.
- **Sessões revogáveis.** Cada token de renovação tem um id (`jti`) gravado na tabela `RefreshToken`. A cada `/auth/refresh` o token usado é **revogado** e um novo é emitido na mesma sessão (rotação). Se um token já usado for apresentado de novo, ele vazou: a sessão inteira é revogada (inclusive o token novo) e a resposta é 401. Duas renovações simultâneas com o mesmo token não passam ambas: a revogação é um `UPDATE ... WHERE revokedAt IS NULL` atômico. `/auth/logout` revoga a sessão do token informado (repetir não tem efeito) sem afetar as outras sessões do usuário. Os tokens vencidos do usuário são apagados a cada emissão.
- **Limite de tentativas de login:** 5 tentativas por IP + e-mail a cada 15 minutos. A sexta responde **429** com o cabeçalho `Retry-After` (segundos), mesmo com a senha certa e sem conferir a senha. A contagem fica no banco (tabela `LoginAttempt`), então vale para todas as instâncias da API que usam o mesmo banco. A tentativa é contada antes da conferência, por um único `upsert` atômico (`INSERT ... ON CONFLICT DO UPDATE`), então requisições simultâneas, em qualquer instância, também esbarram no limite; um login certo apaga a contagem. O IP vem de `request.ip`: atrás de um proxy reverso, ative o `trust proxy` do Express para valer o IP do cliente.
- **Papéis:** `USER` e `ADMIN`. O **primeiro** usuário cadastrado vira `ADMIN`; os seguintes são `USER`. O papel não pode ser escolhido no cadastro (o campo é rejeitado). A regra vale mesmo com cadastros simultâneos num banco vazio: o primeiro ADMIN é gravado com `firstAdmin = true`, coluna de índice único, então só um consegue; quem perde recebe a violação do índice e é gravado como `USER`. Para mudar papéis depois, veja [Administração de usuários](#administração-de-usuários).
- **Respostas:** sem token, token inválido, adulterado ou expirado → **401**; papel insuficiente → **403**. Nas rotas com `@Roles(...)` o guard confere o papel **atual no banco** (o do token não basta), então uma troca de papel vale na hora; as demais rotas protegidas usam só o token. Login com senha errada ou e-mail inexistente devolve a **mesma** mensagem, e o tempo de resposta é parecido nos dois casos (a senha é conferida contra um hash fictício quando o e-mail não existe).
- **E-mail** é guardado em minúsculas e é único (409 em duplicidade). **Senha**: de 8 a 128 caracteres. O hash da senha nunca aparece numa resposta.
- O JWT recusa qualquer cabeçalho diferente de `{"alg":"HS256","typ":"JWT"}` (inclusive o ataque `alg: none`) e compara a assinatura, em tempo constante (`timingSafeEqual`), pelo texto em base64url: outra grafia da mesma assinatura é recusada.

```mermaid
sequenceDiagram
    participant C as Cliente
    participant A as AuthController / AuthService
    participant G as JwtAuthGuard
    participant P as PrototypesController
    C->>A: POST /auth/login { email, password }
    A-->>C: accessToken (15 min) + refreshToken (7 dias)
    C->>G: DELETE /prototypes/1 + Authorization: Bearer accessToken
    G->>G: confere assinatura, validade e typ = access (senão 401)
    G->>G: lê no banco o papel atual para @Roles('ADMIN') (senão 403)
    G->>P: libera, com request.user preenchido
    P-->>C: 204
    C->>A: POST /auth/refresh { refreshToken }
    A->>A: revoga o token usado (reuso → revoga a sessão e 401)
    A-->>C: novo par de tokens
    C->>A: POST /auth/logout { refreshToken }
    A-->>C: 204 (a sessão não renova mais)
```

```bash
# Cadastrar (o primeiro usuário vira ADMIN)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","password":"uma-senha-longa"}'

# Usar o accessToken devolvido nas rotas de escrita
curl -X POST http://localhost:3000/prototypes \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Relatório mensal","primitive":245,"component":"2024-06-15T12:00:00.000Z"}'
```

```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "ana@exemplo.com",
    "role": "ADMIN",
    "createdAt": "2026-10-02T18:00:00.000Z"
  }
}
```

No Swagger (`/docs`), use o botão **Authorize** para informar o token de acesso.

### Administração de usuários

Rotas só para `ADMIN` (`src/users/`):

| Método  | Rota                     | O que faz                                        | Sucesso | Erros                   |
| ------- | ------------------------ | ------------------------------------------------ | ------- | ----------------------- |
| `GET`   | `/users?page=1&limit=10` | Lista os usuários (sem o hash da senha).         | 200     | 400, 401, 403           |
| `PATCH` | `/users/:id/role`        | Muda o papel: `{ "role": "ADMIN" }` ou `"USER"`. | 200     | 400, 401, 403, 404, 409 |

- Rebaixar o **último** `ADMIN` é recusado com **409**, inclusive quando é o próprio usuário. Pedir o papel que o usuário já tem responde 200 sem mudar nada.
- A regra vale com pedidos simultâneos: a troca roda numa transação que começa com `UPDATE "User" SET "role" = "role" WHERE "role" = 'ADMIN'`. O comando não muda nada, mas trava as linhas dos ADMIN e devolve quantos são; dois ADMIN que rebaixam um ao outro ao mesmo tempo são atendidos em sequência, e o segundo recebe 409.
- A troca vale **na hora** nas rotas com `@Roles` (o guard lê o papel no banco): um ADMIN rebaixado perde o acesso de ADMIN com o mesmo token. A troca também **revoga todas as sessões** do usuário (tokens de renovação): para continuar, ele entra de novo e recebe tokens com o papel novo.

```bash
curl -X PATCH http://localhost:3000/users/2/role \
  -H "Authorization: Bearer <accessToken de um ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

### Como a clonagem usa o padrão

```mermaid
sequenceDiagram
    participant Cliente
    participant Service as PrototypesService
    participant Model as PrototypeModel
    participant DB as Prisma / SQLite
    Cliente->>Service: POST /prototypes/1/clone
    Service->>DB: busca o protótipo 1 com o componente circular
    DB-->>Service: registro (404 se não existir)
    Service->>Model: fromRecord(registro)
    Service->>Model: clone()
    Model-->>Service: cópia profunda, com a referência de volta apontando para a cópia
    Service->>DB: cria o novo registro e o componente dele, numa escrita só
    DB-->>Service: novo registro
    Service-->>Cliente: 201 + clone (clonedFromId = 1)
```

O ponto central está em `PrototypesService.clone`: o registro vira um objeto de domínio (`PrototypeModel`), `clone()` produz a cópia, e a cópia é gravada com `toCreateInput()`, que cria o `CircularReference` **aninhado** no novo protótipo. Na versão original o componente novo era conectado ao protótipo de origem, o que quebrava a relação 1:1.

`POST /prototypes/from-template/:key` usa o `PrototypeRegistry`: o catálogo de `src/prototypes/prototype-templates.ts` guarda objetos prontos e cada requisição recebe um clone deles.

### Exemplos

Criar:

```bash
curl -X POST http://localhost:3000/prototypes \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Relatório mensal","primitive":245,"component":"2024-06-15T12:00:00.000Z","circularReference":{"label":"componente A"}}'
```

```json
{
  "id": 1,
  "name": "Relatório mensal",
  "primitive": 245,
  "component": "2024-06-15T12:00:00.000Z",
  "createdAt": "2026-10-01T22:50:00.000Z",
  "updatedAt": "2026-10-01T22:50:00.000Z",
  "clonedFromId": null,
  "circularReference": { "id": 1, "label": "componente A", "prototypeId": 1 }
}
```

Clonar (o corpo é opcional; `name` troca o nome padrão `"<nome> (cópia)"`):

```bash
curl -X POST http://localhost:3000/prototypes/1/clone -H "Authorization: Bearer <accessToken>"
```

```json
{
  "id": 2,
  "name": "Relatório mensal (cópia)",
  "primitive": 245,
  "component": "2024-06-15T12:00:00.000Z",
  "createdAt": "2026-10-01T22:51:00.000Z",
  "updatedAt": "2026-10-01T22:51:00.000Z",
  "clonedFromId": 1,
  "circularReference": { "id": 2, "label": "componente A", "prototypeId": 2 }
}
```

Listar com paginação:

```bash
curl "http://localhost:3000/prototypes?page=1&limit=2"
```

```json
{
  "data": [
    { "id": 1, "...": "..." },
    { "id": 2, "...": "..." }
  ],
  "meta": { "total": 2, "page": 1, "limit": 2, "totalPages": 1 }
}
```

### Validação e erros

- Os corpos são validados por DTOs com `class-validator`. Campos desconhecidos são **rejeitados** (não ignorados).
- `name`: texto de 1 a 100 caracteres. `primitive`: inteiro de 32 bits. `component`: data em ISO 8601. `circularReference.label`: texto de 1 a 100 caracteres.
- `:id` passa por `ParseIntPipe`; um id que não é número responde 400.
- `PATCH` e `DELETE` de um id inexistente respondem 404 por meio de um filtro de exceção (`PrismaExceptionFilter`), que traduz o erro `P2025` do Prisma; o mesmo filtro traduz violação de valor único (`P2002`) em 409.
- Nas rotas protegidas, o token é conferido **antes** do corpo: sem token a resposta é 401 mesmo com o corpo inválido.

Todos os erros seguem o formato padrão do NestJS:

```json
{
  "message": ["primitive must be an integer number"],
  "error": "Bad Request",
  "statusCode": 400
}
```

<a id="como-rodar"></a>
## ⚡ Quick Start (Início Rápido em 3 Passos)

Pré-requisitos: **Node.js 22.13 ou mais novo** e npm.

1. **Clonar e Instalar Dependências:**
   ```bash
   git clone https://github.com/seu-usuario/Projeto-Typescript.git && cd Projeto-Typescript
   npm install
   ```

2. **Configurar Ambiente e Banco de Dados (SQLite):**
   ```bash
   cp .env.example .env        # No Windows: Copy-Item .env.example .env
   npm run prisma:deploy       # cria o dev.db e aplica as migrações
   npm run db:seed             # opcional: popula catálogo com protótipos
   ```

3. **Iniciar a API em Desenvolvimento:**
   ```bash
   npm run start:dev           # API disponível em http://localhost:3000
   ```

No `.env`, troque `JWT_SECRET` por um valor aleatório de 32 caracteres ou mais (sem ele a API não sobe). Para gerar um:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Depois, cadastre o primeiro usuário em `POST /auth/register`: ele será o `ADMIN`.

### Variáveis de ambiente

| Variável            | Padrão   | Descrição                                                                           |
| ------------------- | -------- | ----------------------------------------------------------------------------------- |
| `PORT`              | `3000`   | Porta HTTP.                                                                         |
| `DATABASE_PROVIDER` | `sqlite` | Banco em uso: `sqlite` ou `postgresql`.                                             |
| `DATABASE_URL`      | —        | URL do banco, obrigatória. No SQLite, `file:./dev.db` é relativo à pasta `prisma/`. |
| `JWT_SECRET`        | —        | Segredo da assinatura dos tokens, obrigatório, com 32 caracteres ou mais.           |
| `JWT_ACCESS_TTL`    | `900`    | Validade do token de acesso, em segundos (de 60 a 86400).                           |
| `JWT_REFRESH_TTL`   | `604800` | Validade do token de renovação, em segundos (de 60 a 90 dias).                      |

As variáveis são validadas na inicialização: com valor inválido a aplicação nem sobe e informa todos os motivos de uma vez.

### Banco de dados: SQLite (padrão) ou PostgreSQL

O SQLite continua sendo o padrão e não exige nada instalado. Para usar PostgreSQL, defina `DATABASE_PROVIDER=postgresql` e uma `DATABASE_URL` de PostgreSQL no `.env`:

```dotenv
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://usuario:senha@localhost:5432/prototypes"
```

e rode de novo:

```bash
npm run prisma:generate   # gera o cliente do Prisma para o PostgreSQL
npm run prisma:deploy     # aplica as migrações do PostgreSQL
```

Como funciona: o Prisma 6 não aceita trocar o `provider` do `datasource` por variável de ambiente, então existem **dois schemas com os mesmos modelos**:

| Banco      | Schema                          | Migrações                     |
| ---------- | ------------------------------- | ----------------------------- |
| SQLite     | `prisma/schema.prisma`          | `prisma/migrations/`          |
| PostgreSQL | `prisma/postgres/schema.prisma` | `prisma/postgres/migrations/` |

Os scripts `prisma:generate`, `prisma:migrate` e `prisma:deploy` passam por `prisma/prisma-cli.mjs`, que lê `DATABASE_PROVIDER` (do ambiente ou do `.env`) e chama o Prisma com o `--schema` certo. Ao mudar um modelo, altere **os dois** schemas e gere a migração de cada banco (`npm run prisma:migrate` com cada valor de `DATABASE_PROVIDER`). A validação do ambiente confere se a `DATABASE_URL` combina com o banco escolhido. O papel do usuário é um texto, e não um `enum`, justamente para o mesmo modelo valer nos dois bancos. Os testes e2e usam SQLite por padrão e também rodam contra PostgreSQL (veja [Testes e qualidade](#testes-e-qualidade)).

### Scripts

| Script                    | O que faz                                                     |
| ------------------------- | ------------------------------------------------------------- |
| `npm run start:dev`       | Sobe a API com recarga automática.                            |
| `npm run build`           | Compila para `dist/`.                                         |
| `npm run start:prod`      | Roda a versão compilada (`node dist/main.js`).                |
| `npm run examples`        | Compila e executa os exemplos de todos os padrões.            |
| `npm test`                | Testes unitários.                                             |
| `npm run test:cov`        | Testes unitários com cobertura.                               |
| `npm run test:e2e`        | Testes de ponta a ponta da API.                               |
| `npm run lint`            | ESLint.                                                       |
| `npm run format`          | Formata com Prettier (`format:check` só verifica).            |
| `npm run typecheck`       | Checagem de tipos de `src/` e `test/`, sem gerar arquivos.    |
| `npm run prisma:generate` | Gera o cliente do Prisma para o banco de `DATABASE_PROVIDER`. |
| `npm run prisma:migrate`  | Cria e aplica uma migração nova (desenvolvimento).            |
| `npm run prisma:deploy`   | Aplica as migrações existentes do banco escolhido.            |
| `npm run db:seed`         | Compila e popula um banco vazio.                              |

## Testes e qualidade

- **Unitários** (`src/**/*.spec.ts`): cópia rasa e profunda (ciclos, `Date`, `RegExp`, `Map`, `Set`, arrays esparsos, classes, getters, `Symbol`), registro de protótipos, os cinco padrões novos e os exemplos de todos, validação do ambiente (incluindo banco e JWT), objeto de domínio, regras do `PrototypesService`, do `AuthService` (rotação, reuso, logout, limite de login, corrida do primeiro ADMIN) e do `UsersService` com o Prisma simulado, o limitador de tentativas (com a tabela simulada), JWT (assinatura, expiração, adulteração, `alg: none`), hash de senha e o `JwtAuthGuard` (401/403).
- **E2E** (`test/*.e2e-spec.ts`): sobem a aplicação inteira e chamam os endpoints com `supertest`, contra um banco de verdade: CRUD e clonagem de protótipos, cadastro (inclusive cadastros simultâneos no banco vazio), login e o 429 com `Retry-After` (inclusive com duas instâncias da API sobre o mesmo banco, em sequência e em paralelo), rotação e reuso do token de renovação, logout, `/auth/me`, a administração de papéis (inclusive dois ADMIN rebaixando um ao outro ao mesmo tempo e o ADMIN rebaixado perdendo o acesso na hora) e as regras de acesso (401 sem token, 403 para quem não é `ADMIN`). Os arquivos rodam um de cada vez (`maxWorkers: 1`), porque compartilham o mesmo banco. Por padrão o banco é um SQLite criado numa pasta temporária do sistema (fora do repositório), que recebe as migrações e é apagado no fim. Com `E2E_POSTGRES_URL`, os mesmos testes rodam contra PostgreSQL, num schema novo (`e2e_<aleatório>`) criado dentro do banco informado e apagado no fim. O tempo limite por teste e por hook é de 60 s (`testTimeout` em `test/jest-e2e.json`), e não os 5 s padrão do Jest: subir o NestJS e carregar o motor nativo do Prisma no `beforeAll` passava de 5 s com a máquina carregada ou com o cache de disco frio, e aí os testes falhavam juntos.

```bash
npm test
npm run test:e2e
```

E2E contra PostgreSQL (o cliente do Prisma precisa ser gerado para PostgreSQL; no fim, gere de novo para SQLite):

```bash
DATABASE_PROVIDER=postgresql npm run prisma:generate
E2E_POSTGRES_URL="postgresql://usuario:senha@localhost:5432/banco" npm run test:e2e
npm run prisma:generate    # volta ao SQLite
```

No PowerShell, defina as variáveis antes: `$env:DATABASE_PROVIDER="postgresql"` e `$env:E2E_POSTGRES_URL="postgresql://..."` (e `Remove-Item Env:DATABASE_PROVIDER` antes de voltar ao SQLite).

O workflow `.github/workflows/ci.yml` roda, em Node 22 e 24: instalação, `prisma generate`, verificação de formatação, lint, checagem de tipos, build, testes unitários e testes e2e com SQLite. Um segundo job roda os testes e2e contra um PostgreSQL 17 (contêiner de serviço do GitHub Actions).

## Estrutura do projeto

```text
.
├── prisma/
│   ├── schema.prisma               # modelos Prototype, CircularReference, User, RefreshToken e LoginAttempt (SQLite)
│   ├── migrations/                 # migrações SQL do SQLite
│   ├── postgres/                   # schema e migrações do PostgreSQL
│   └── prisma-cli.mjs              # escolhe o schema pelo DATABASE_PROVIDER
├── src/
│   ├── prototype-pattern/          # biblioteca do padrão (sem dependências)
│   │   ├── prototype.ts            # interface Prototype<T>
│   │   ├── clone.ts                # shallowClone e deepClone
│   │   ├── cloneable.ts            # classe base Cloneable
│   │   ├── registry.ts             # PrototypeRegistry
│   │   └── examples/               # exemplos executáveis
│   ├── design-patterns/            # Builder, Factory Method, Abstract Factory, Observer, Strategy
│   │   ├── <padrão>/               # contrato, implementação, exemplo e testes de cada um
│   │   └── examples.ts             # roda os exemplos dos cinco padrões
│   ├── auth/                       # JWT (HMAC-SHA256), senhas (scrypt), guard, papéis, limite de login e rotas /auth
│   ├── users/                      # rotas /users (só ADMIN): lista e troca de papel
│   ├── prototypes/                 # recurso REST
│   │   ├── dto/                    # entrada, com validação
│   │   ├── entities/               # formato das respostas (OpenAPI)
│   │   ├── prototype.model.ts      # objeto de domínio clonável
│   │   ├── prototype-templates.ts  # catálogo de modelos
│   │   ├── prototypes.controller.ts
│   │   ├── prototypes.service.ts
│   │   └── prototypes.module.ts
│   ├── common/                     # paginação e filtro de exceções do Prisma
│   ├── config/                     # validação das variáveis de ambiente
│   ├── prisma/                     # PrismaService e PrismaModule
│   ├── database/seed.ts            # seed
│   ├── app.module.ts
│   ├── swagger.ts
│   └── main.ts
├── test/                           # testes e2e e o banco temporário deles
└── .github/workflows/ci.yml
```

## Limitações conhecidas

- **Nas rotas sem `@Roles`, o token de ACESSO vale até expirar.** O logout, a rotação e a troca de papel revogam os tokens de renovação, e as rotas com `@Roles` conferem o papel no banco; as demais rotas protegidas (criar, alterar e clonar protótipos) aceitam o token de acesso sem ir ao banco, por isso ele vive pouco (15 minutos por padrão).
- **Dois schemas do Prisma.** O suporte a PostgreSQL exige manter `prisma/schema.prisma` e `prisma/postgres/schema.prisma` com os mesmos modelos, e gerar a migração de cada banco.
- **`PATCH` não remove o componente circular.** Dá para criar ou renomear, mas não para apagar só o componente; para isso é preciso apagar o protótipo.
- **O catálogo de modelos é fixo no código** (`prototype-templates.ts`); não há endpoint para cadastrar modelos.
- **`deepClone` não reconstrói** `WeakMap`, `WeakSet`, `WeakRef`, `Promise` nem funções (ficam por referência); subclasses de `Map`, `Set` e `Date` voltam como a classe base; e o estado de `Object.freeze`/`Object.seal` não é copiado.
- **Versões:** o projeto usa NestJS 11, Prisma 6 e TypeScript 5.9. O NestJS 12 (somente ESM) e o Prisma 7 (que exige adaptador de driver e outro formato de configuração) pedem uma migração à parte.
