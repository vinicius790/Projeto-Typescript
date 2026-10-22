import { createTemplateRegistry } from './prototype-templates';
import { BackReference, PrototypeModel, PrototypeRecord } from './prototype.model';

const record: PrototypeRecord = {
  id: 7,
  name: 'Original',
  primitive: 245,
  component: new Date('2024-06-15T12:00:00.000Z'),
  createdAt: new Date('2024-06-01T00:00:00.000Z'),
  updatedAt: new Date('2024-06-02T00:00:00.000Z'),
  clonedFromId: null,
  circularReference: { id: 3, label: 'componente A', prototypeId: 7 },
};

describe('PrototypeModel', () => {
  it('é montado a partir de um registro do banco', () => {
    const model = PrototypeModel.fromRecord(record);

    expect(model.name).toBe('Original');
    expect(model.primitive).toBe(245);
    expect(model.component).toEqual(record.component);
    expect(model.circularReference?.label).toBe('componente A');
    expect(model.circularReference?.owner).toBe(model);
  });

  it('não cria componente circular quando o registro não tem um', () => {
    const model = PrototypeModel.fromRecord({ ...record, circularReference: null });

    expect(model.circularReference).toBeUndefined();
    expect(model.toCreateInput().circularReference).toBeUndefined();
  });

  it('clone() copia os dados e aponta a referência circular para o clone', () => {
    const original = PrototypeModel.fromRecord(record);

    const copy = original.clone();

    expect(copy).toBeInstanceOf(PrototypeModel);
    expect(copy).not.toBe(original);
    expect(copy.component).not.toBe(original.component);
    expect(copy.component.getTime()).toBe(original.component.getTime());
    expect(copy.circularReference).toBeInstanceOf(BackReference);
    expect(copy.circularReference).not.toBe(original.circularReference);
    expect(copy.circularReference?.owner).toBe(copy);
    expect(original.circularReference?.owner).toBe(original);
  });

  it('alterar o clone não altera o original', () => {
    const original = PrototypeModel.fromRecord(record);

    const copy = original.clone();
    copy.name = 'Cópia';
    copy.component.setUTCFullYear(1999);
    if (copy.circularReference) {
      copy.circularReference.label = 'outro';
    }

    expect(original.name).toBe('Original');
    expect(original.component.toISOString()).toBe('2024-06-15T12:00:00.000Z');
    expect(original.circularReference?.label).toBe('componente A');
  });

  it('toCreateInput() descreve um registro novo, sem id e com o componente aninhado', () => {
    expect(PrototypeModel.fromRecord(record).toCreateInput()).toStrictEqual({
      name: 'Original',
      primitive: 245,
      component: new Date('2024-06-15T12:00:00.000Z'),
      circularReference: { create: { label: 'componente A' } },
    });
  });
});

describe('createTemplateRegistry', () => {
  it('oferece os modelos do catálogo como objetos independentes', () => {
    const registry = createTemplateRegistry();

    const first = registry.create('com-referencia');
    const second = registry.create('com-referencia');

    expect(registry.keys()).toEqual(['basico', 'com-referencia']);
    expect(first).toBeInstanceOf(PrototypeModel);
    expect(first.component).not.toBe(second.component);
    expect(first.circularReference?.owner).toBe(first);
    expect(registry.create('basico').circularReference).toBeUndefined();
  });
});
