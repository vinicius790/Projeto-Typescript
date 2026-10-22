import type { Prototype } from './prototype';

export class PrototypeNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`Nenhum protótipo registrado com a chave "${key}".`);
    this.name = 'PrototypeNotFoundError';
  }
}

/**
 * Registro de protótipos (Prototype Registry): um catálogo de objetos
 * pré-configurados, identificados por uma chave. Novos objetos nascem como
 * clones de um item do catálogo, em vez de serem montados do zero.
 */
export class PrototypeRegistry<T extends Prototype<T>> {
  private readonly prototypes = new Map<string, T>();

  /**
   * Guarda uma CÓPIA do protótipo, para que alterações feitas depois no objeto
   * de quem registrou não contaminem o catálogo. Registrar uma chave que já
   * existe substitui o protótipo anterior.
   */
  register(key: string, prototype: T): this {
    this.prototypes.set(key, prototype.clone());
    return this;
  }

  unregister(key: string): boolean {
    return this.prototypes.delete(key);
  }

  has(key: string): boolean {
    return this.prototypes.has(key);
  }

  keys(): string[] {
    return [...this.prototypes.keys()];
  }

  /**
   * Devolve um clone novo do protótipo registrado.
   *
   * @throws PrototypeNotFoundError se a chave não estiver registrada.
   */
  create(key: string): T {
    const prototype = this.prototypes.get(key);
    if (!prototype) {
      throw new PrototypeNotFoundError(key);
    }
    return prototype.clone();
  }
}
