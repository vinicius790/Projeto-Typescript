import { deepClone, shallowClone } from './clone';

class Point {
  constructor(
    public x: number,
    public y: number,
  ) {}

  sum(): number {
    return this.x + this.y;
  }
}

describe('shallowClone', () => {
  it('devolve valores primitivos e null como estão', () => {
    expect(shallowClone(42)).toBe(42);
    expect(shallowClone('texto')).toBe('texto');
    expect(shallowClone(null)).toBeNull();
    expect(shallowClone(undefined)).toBeUndefined();
  });

  it('cria um novo objeto de primeiro nível, mas compartilha os objetos aninhados', () => {
    const original = { name: 'a', nested: { value: 1 }, when: new Date(0) };

    const copy = shallowClone(original);

    expect(copy).not.toBe(original);
    expect(copy).toEqual(original);
    expect(copy.nested).toBe(original.nested);
    expect(copy.when).toBe(original.when);

    copy.name = 'b';
    copy.nested.value = 2;
    expect(original.name).toBe('a');
    expect(original.nested.value).toBe(2);
  });

  it('preserva a classe do objeto (cadeia de protótipos)', () => {
    const copy = shallowClone(new Point(1, 2));

    expect(copy).toBeInstanceOf(Point);
    expect(copy.sum()).toBe(3);
  });

  it('preserva getters e propriedades não enumeráveis', () => {
    const original = {
      first: 'Ana',
      get shout(): string {
        return this.first.toUpperCase();
      },
    };
    Object.defineProperty(original, 'hidden', { value: 1, enumerable: false });

    const copy = shallowClone(original);
    copy.first = 'Bia';

    expect(copy.shout).toBe('BIA');
    expect(Object.keys(copy)).toEqual(['first', 'shout']);
    expect(Object.getOwnPropertyDescriptor(copy, 'hidden')?.value).toBe(1);
  });

  it('copia o primeiro nível de arrays, Map, Set e Date', () => {
    const item = { id: 1 };
    const array = [item];
    const map = new Map([['k', item]]);
    const set = new Set([item]);
    const date = new Date('2024-01-01T00:00:00.000Z');

    const arrayCopy = shallowClone(array);
    const mapCopy = shallowClone(map);
    const setCopy = shallowClone(set);
    const dateCopy = shallowClone(date);

    expect(arrayCopy).not.toBe(array);
    expect(arrayCopy[0]).toBe(item);
    expect(mapCopy).not.toBe(map);
    expect(mapCopy.get('k')).toBe(item);
    expect(setCopy).not.toBe(set);
    expect(setCopy.has(item)).toBe(true);
    expect(dateCopy).not.toBe(date);
    expect(dateCopy.getTime()).toBe(date.getTime());
  });

  it('copia Buffer em memória independente e preserva o tipo Node', () => {
    const original = Buffer.from([1, 2, 3]);
    const copy = shallowClone(original);

    expect(Buffer.isBuffer(copy)).toBe(true);
    expect(copy).not.toBe(original);
    copy[0] = 9;
    expect([...original]).toEqual([1, 2, 3]);
  });
});

describe('deepClone', () => {
  it('devolve valores primitivos e null como estão', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('texto')).toBe('texto');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(10n)).toBe(10n);
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
  });

  it('duplica objetos aninhados: alterar a cópia não afeta o original', () => {
    const original = { level1: { level2: { values: [1, 2, 3] } } };

    const copy = deepClone(original);
    copy.level1.level2.values.push(4);

    expect(copy.level1).not.toBe(original.level1);
    expect(copy.level1.level2).not.toBe(original.level1.level2);
    expect(original.level1.level2.values).toEqual([1, 2, 3]);
    expect(copy.level1.level2.values).toEqual([1, 2, 3, 4]);
  });

  it('clona Date mantendo o instante', () => {
    const original = { when: new Date('2024-06-15T12:00:00.000Z') };

    const copy = deepClone(original);
    copy.when.setUTCFullYear(1999);

    expect(copy.when).toBeInstanceOf(Date);
    expect(copy.when).not.toBe(original.when);
    expect(original.when.toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('clona RegExp com flags e lastIndex', () => {
    const original = /a+/gi;
    original.lastIndex = 3;

    const copy = deepClone(original);

    expect(copy).not.toBe(original);
    expect(copy.source).toBe('a+');
    expect(copy.flags).toBe('gi');
    expect(copy.lastIndex).toBe(3);
  });

  it('clona Map em profundidade, incluindo chaves que são objetos', () => {
    const key = { id: 1 };
    const original = new Map<object | string, { tags: string[] }>([
      [key, { tags: ['a'] }],
      ['texto', { tags: ['b'] }],
    ]);

    const copy = deepClone(original);
    const [copiedKey] = [...copy.keys()];

    expect(copy).toBeInstanceOf(Map);
    expect(copy.size).toBe(2);
    expect(copiedKey).toEqual(key);
    expect(copiedKey).not.toBe(key);
    expect(copy.get('texto')).toEqual({ tags: ['b'] });
    expect(copy.get('texto')).not.toBe(original.get('texto'));
  });

  it('clona Set em profundidade', () => {
    const member = { id: 1 };
    const original = new Set([member]);

    const copy = deepClone(original);
    const [copiedMember] = [...copy];

    expect(copy).toBeInstanceOf(Set);
    expect(copiedMember).toEqual(member);
    expect(copiedMember).not.toBe(member);
  });

  it('clona arrays, inclusive esparsos', () => {
    const original: unknown[] = [{ a: 1 }, [2, 3]];
    original[5] = 'fim';

    const copy = deepClone(original);

    expect(Array.isArray(copy)).toBe(true);
    expect(copy).toHaveLength(6);
    expect(copy[0]).toEqual({ a: 1 });
    expect(copy[0]).not.toBe(original[0]);
    expect(copy[1]).not.toBe(original[1]);
    expect(3 in copy).toBe(false);
    expect(copy[5]).toBe('fim');
  });

  it('clona typed arrays e ArrayBuffer', () => {
    const original = { bytes: new Uint8Array([1, 2, 3]) };

    const copy = deepClone(original);
    copy.bytes[0] = 9;

    expect(copy.bytes).toBeInstanceOf(Uint8Array);
    expect(copy.bytes.buffer).not.toBe(original.bytes.buffer);
    expect([...original.bytes]).toEqual([1, 2, 3]);
  });

  it('clona Buffer e preserva referências repetidas', () => {
    const bytes = Buffer.from([1, 2, 3]);
    const copy = deepClone({ first: bytes, repeated: bytes });

    expect(Buffer.isBuffer(copy.first)).toBe(true);
    expect(copy.first).not.toBe(bytes);
    expect(copy.first).toBe(copy.repeated);
    copy.first[0] = 9;
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it('preserva a classe e os métodos de instâncias aninhadas', () => {
    const original = { origin: new Point(1, 2) };

    const copy = deepClone(original);
    copy.origin.x = 10;

    expect(copy.origin).toBeInstanceOf(Point);
    expect(copy.origin.sum()).toBe(12);
    expect(original.origin.sum()).toBe(3);
  });

  it('resolve referência circular: o ciclo da cópia aponta para a própria cópia', () => {
    interface Node {
      name: string;
      self?: Node;
      children: Node[];
      parent?: Node;
    }
    const root: Node = { name: 'raiz', children: [] };
    root.self = root;
    const child: Node = { name: 'filho', children: [], parent: root };
    root.children.push(child);

    const copy = deepClone(root);

    expect(copy).not.toBe(root);
    expect(copy.self).toBe(copy);
    expect(copy.children[0]).not.toBe(child);
    expect(copy.children[0]?.parent).toBe(copy);
  });

  it('resolve ciclos dentro de arrays, Map e Set', () => {
    const array: unknown[] = [];
    array.push(array);
    const map = new Map<string, unknown>();
    map.set('eu', map);
    const set = new Set<unknown>();
    set.add(set);

    const arrayCopy = deepClone(array);
    const mapCopy = deepClone(map);
    const setCopy = deepClone(set);

    expect(arrayCopy).not.toBe(array);
    expect(arrayCopy[0]).toBe(arrayCopy);
    expect(mapCopy.get('eu')).toBe(mapCopy);
    expect(setCopy.has(setCopy)).toBe(true);
    expect(setCopy.has(set)).toBe(false);
  });

  it('mantém referências compartilhadas como compartilhadas dentro da cópia', () => {
    const shared = { value: 1 };
    const original = { first: shared, second: shared };

    const copy = deepClone(original);

    expect(copy.first).toBe(copy.second);
    expect(copy.first).not.toBe(shared);
  });

  it('copia chaves Symbol, getters e propriedades não enumeráveis', () => {
    const tag = Symbol('tag');
    const original = {
      [tag]: { secret: true },
      base: 2,
      get double(): number {
        return this.base * 2;
      },
    };
    Object.defineProperty(original, 'hidden', { value: { deep: 1 }, enumerable: false });

    const copy = deepClone(original);
    copy.base = 5;
    const hidden = Object.getOwnPropertyDescriptor(copy, 'hidden');
    const originalHidden = Object.getOwnPropertyDescriptor(original, 'hidden');

    expect(copy[tag]).toEqual({ secret: true });
    expect(copy[tag]).not.toBe(original[tag]);
    expect(copy.double).toBe(10);
    expect(original.double).toBe(4);
    expect(hidden?.enumerable).toBe(false);
    expect(hidden?.value).toEqual({ deep: 1 });
    expect(hidden?.value).not.toBe(originalHidden?.value);
  });

  it('clona objetos sem protótipo', () => {
    const original = Object.create(null) as Record<string, unknown>;
    original.nested = { a: 1 };

    const copy = deepClone(original);

    expect(Object.getPrototypeOf(copy)).toBeNull();
    expect(copy.nested).toEqual({ a: 1 });
    expect(copy.nested).not.toBe(original.nested);
  });

  it('mantém funções e estruturas não clonáveis (WeakMap, Promise) por referência', () => {
    const handler = (): string => 'ok';
    const cache = new WeakMap<object, string>();
    const pending = Promise.resolve(1);
    const original = { handler, cache, pending };

    const copy = deepClone(original);

    expect(copy.handler).toBe(handler);
    expect(copy.cache).toBe(cache);
    expect(copy.pending).toBe(pending);
  });

  it('faz o que structuredClone não faz: mantém a classe da instância', () => {
    const original = new Point(1, 2);

    expect(structuredClone(original)).not.toBeInstanceOf(Point);
    expect(deepClone(original)).toBeInstanceOf(Point);
  });
});
