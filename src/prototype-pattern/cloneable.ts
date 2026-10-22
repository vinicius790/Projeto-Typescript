import { deepClone, shallowClone } from './clone';
import type { Prototype } from './prototype';

/**
 * Classe base opcional: quem a estende ganha `clone()` (cópia profunda) e
 * `shallowClone()` (cópia rasa) sem escrever nada.
 *
 * O tipo de retorno `this` faz a cópia de uma subclasse ter o tipo da subclasse.
 */
export abstract class Cloneable implements Prototype<Cloneable> {
  clone(): this {
    return deepClone(this);
  }

  shallowClone(): this {
    return shallowClone(this);
  }
}
