/**
 * Contrato do padrão Factory Method: existe uma operação que cria o produto,
 * mas QUAL classe concreta é instanciada fica a cargo de quem implementa.
 *
 * O código que usa o produto depende só deste contrato e da interface do
 * produto; acrescentar um produto novo é acrescentar um criador novo, sem
 * mexer no código que já existe.
 *
 * @typeParam T interface do produto criado.
 */
export interface Creator<T> {
  create(): T;
}
