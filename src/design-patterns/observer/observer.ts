/**
 * Contrato do padrão Observer, lado de quem escuta: recebe cada evento
 * publicado pelo sujeito que está observando.
 *
 * @typeParam T tipo do evento.
 */
export interface Observer<T> {
  update(event: T): void;
}

/** Cancela uma inscrição. Chamar mais de uma vez não tem efeito. */
export type Unsubscribe = () => void;

/**
 * Contrato do padrão Observer, lado de quem publica. O sujeito não conhece os
 * observadores: só mantém a lista e avisa todos quando algo acontece.
 */
export interface Subject<T> {
  subscribe(observer: Observer<T> | ((event: T) => void)): Unsubscribe;
  notify(event: T): void;
}
