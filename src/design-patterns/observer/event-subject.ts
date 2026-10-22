import type { Observer, Subject, Unsubscribe } from './observer';

/**
 * Sujeito concreto e reutilizável. Aceita tanto objetos `Observer` quanto
 * funções simples, e avisa os observadores na ordem em que se inscreveram.
 */
export class EventSubject<T> implements Subject<T> {
  // Chave: o que foi inscrito (objeto ou função); valor: o observador a avisar.
  private readonly observers = new Map<Observer<T> | ((event: T) => void), Observer<T>>();

  /**
   * Inscreve um observador e devolve a função que cancela a inscrição.
   * Inscrever o mesmo objeto (ou a mesma função) duas vezes não o faz ser
   * avisado em dobro.
   */
  subscribe(observer: Observer<T> | ((event: T) => void)): Unsubscribe {
    if (!this.observers.has(observer)) {
      this.observers.set(
        observer,
        typeof observer === 'function' ? { update: observer } : observer,
      );
    }
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Avisa todos os observadores. A lista é copiada antes do percurso: quem se
   * inscreve durante a notificação só recebe o PRÓXIMO evento, e cancelar a
   * própria inscrição dentro de `update` não faz outro observador ser pulado.
   * Quem cancela a inscrição de OUTRO observador ainda não avisado nesta
   * rodada impede que ele seja avisado.
   */
  notify(event: T): void {
    for (const [key, observer] of [...this.observers]) {
      if (this.observers.has(key)) {
        observer.update(event);
      }
    }
  }

  /** Quantidade de observadores inscritos. */
  get size(): number {
    return this.observers.size;
  }
}
