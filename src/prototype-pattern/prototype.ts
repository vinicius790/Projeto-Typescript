/**
 * Contrato do padrão Prototype: o próprio objeto sabe produzir uma cópia de si.
 *
 * Quem pede a cópia não precisa conhecer a classe concreta nem como ela é
 * montada; basta chamar `clone()`.
 *
 * @typeParam T tipo devolvido pela clonagem (normalmente a própria classe).
 */
export interface Prototype<T> {
  clone(): T;
}
