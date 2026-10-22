import { deepClone } from '../clone';
import type { Prototype } from '../prototype';

/** Componente que guarda uma referência de volta ao objeto que o contém. */
export class ComponentWithBackReference {
  constructor(public prototype: ConcretePrototype) {}
}

/**
 * Protótipo concreto com um valor primitivo, um objeto aninhado (`Date`) e uma
 * referência circular (o componente aponta de volta para o próprio protótipo).
 */
export class ConcretePrototype implements Prototype<ConcretePrototype> {
  public circularReference?: ComponentWithBackReference;

  constructor(
    public primitive: number,
    public component: Date,
  ) {}

  clone(): this {
    return deepClone(this);
  }
}

export type Log = (message: string) => void;

export function runCircularReferenceExample(log: Log = console.log): void {
  const original = new ConcretePrototype(245, new Date());
  original.circularReference = new ComponentWithBackReference(original);

  const copy = original.clone();

  log('--- Referência circular ---');
  log(
    original.primitive === copy.primitive
      ? 'OK: o valor primitivo foi levado para o clone.'
      : 'FALHA: o valor primitivo não foi copiado.',
  );
  log(
    original.component !== copy.component
      ? 'OK: o componente (Date) foi clonado, não compartilhado.'
      : 'FALHA: o componente (Date) é o mesmo objeto do original.',
  );
  log(
    original.circularReference !== copy.circularReference
      ? 'OK: o componente com referência de volta foi clonado.'
      : 'FALHA: o componente com referência de volta é compartilhado.',
  );
  log(
    copy.circularReference?.prototype === copy
      ? 'OK: a referência de volta do clone aponta para o próprio clone.'
      : 'FALHA: a referência de volta do clone aponta para o objeto original.',
  );
}
