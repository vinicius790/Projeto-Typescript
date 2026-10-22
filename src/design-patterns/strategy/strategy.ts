/**
 * Contrato do padrão Strategy: uma família de algoritmos intercambiáveis, todos
 * com a mesma entrada e a mesma saída.
 *
 * @typeParam Input o que o algoritmo recebe.
 * @typeParam Output o que o algoritmo devolve.
 */
export interface Strategy<Input, Output> {
  execute(input: Input): Output;
}

/**
 * Contexto: guarda a estratégia atual e delega o trabalho a ela. Trocar o
 * algoritmo é trocar o objeto, em tempo de execução, sem `if`/`switch` no
 * código que usa o contexto.
 */
export class StrategyContext<Input, Output> {
  constructor(private strategy: Strategy<Input, Output>) {}

  use(strategy: Strategy<Input, Output>): this {
    this.strategy = strategy;
    return this;
  }

  execute(input: Input): Output {
    return this.strategy.execute(input);
  }
}
