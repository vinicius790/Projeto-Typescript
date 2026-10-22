import type { Prisma } from '@prisma/client';
import { Cloneable } from '../prototype-pattern';

/** Toda leitura e escrita da API traz o componente circular junto. */
export const prototypeInclude = { circularReference: true } satisfies Prisma.PrototypeInclude;

/** Formato de um protótipo como ele é gravado e devolvido pela API. */
export type PrototypeRecord = Prisma.PrototypeGetPayload<{ include: typeof prototypeInclude }>;

/** Componente que aponta de volta para o protótipo que o contém. */
export class BackReference {
  constructor(
    public label: string,
    public owner: PrototypeModel,
  ) {}
}

/**
 * Objeto de domínio clonável. É aqui que a API aplica o padrão Prototype:
 * `clone()` (herdado de `Cloneable`) devolve uma cópia profunda, com `Date`
 * próprio e com a referência circular apontando para a CÓPIA, não para o original.
 */
export class PrototypeModel extends Cloneable {
  circularReference?: BackReference;

  constructor(
    public name: string,
    public primitive: number,
    public component: Date,
    circularReferenceLabel?: string,
  ) {
    super();
    if (circularReferenceLabel !== undefined) {
      this.circularReference = new BackReference(circularReferenceLabel, this);
    }
  }

  static fromRecord(record: PrototypeRecord): PrototypeModel {
    return new PrototypeModel(
      record.name,
      record.primitive,
      record.component,
      record.circularReference?.label,
    );
  }

  /**
   * Dados para gravar este objeto como um NOVO registro. O componente circular
   * é criado junto, em escrita aninhada, e por isso nasce ligado ao novo
   * protótipo.
   */
  toCreateInput(): Prisma.PrototypeCreateInput {
    return {
      name: this.name,
      primitive: this.primitive,
      component: this.component,
      circularReference: this.circularReference
        ? { create: { label: this.circularReference.label } }
        : undefined,
    };
  }
}
