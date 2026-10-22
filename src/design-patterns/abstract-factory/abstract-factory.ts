/**
 * Contrato do padrão Abstract Factory: uma fábrica produz uma FAMÍLIA de
 * produtos que combinam entre si (o botão e a caixa de seleção do mesmo tema,
 * por exemplo), sem que o cliente conheça as classes concretas.
 *
 * `Products` mapeia o nome de cada produto para a interface dele, então
 * `create('button')` já sai com o tipo `Products['button']`.
 *
 * @typeParam Products mapa "nome do produto → interface do produto".
 */
export interface AbstractFactory<Products extends Record<string, unknown>> {
  create<K extends keyof Products>(kind: K): Products[K];
}

/** As receitas de uma família: uma função criadora para cada produto. */
export type ProductMakers<Products extends Record<string, unknown>> = {
  readonly [K in keyof Products]: () => Products[K];
};

/**
 * Implementação genérica: uma fábrica concreta é um conjunto de receitas. O
 * compilador exige uma receita para CADA produto do mapa, então uma família
 * nunca fica incompleta.
 */
export class FamilyFactory<
  Products extends Record<string, unknown>,
> implements AbstractFactory<Products> {
  constructor(private readonly makers: ProductMakers<Products>) {}

  create<K extends keyof Products>(kind: K): Products[K] {
    return this.makers[kind]();
  }

  /** Nomes dos produtos que esta fábrica sabe criar. */
  kinds(): (keyof Products)[] {
    return Object.keys(this.makers);
  }
}
