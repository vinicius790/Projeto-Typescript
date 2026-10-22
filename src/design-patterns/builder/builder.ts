/**
 * Contrato do padrão Builder: um objeto complexo é montado passo a passo, por
 * métodos encadeáveis, e só no fim `build()` entrega o produto pronto.
 *
 * Quem usa o builder não precisa conhecer a ordem dos passos nem os valores
 * padrão: ou o produto sai válido, ou `build()` lança erro.
 *
 * @typeParam T tipo do produto montado.
 */
export interface Builder<T> {
  build(): T;
}

/** Lançado por `build()` quando a configuração acumulada não forma um produto válido. */
export class BuilderValidationError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Não foi possível montar o objeto: ${problems.join('; ')}.`);
    this.name = 'BuilderValidationError';
  }
}
