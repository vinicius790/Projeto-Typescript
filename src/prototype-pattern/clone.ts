import { Buffer } from 'node:buffer';

/**
 * Cópia rasa: cria um novo objeto de primeiro nível, mas os valores aninhados
 * continuam sendo OS MESMOS objetos do original (são compartilhados).
 *
 * Preserva a cadeia de protótipos (métodos de classe) e os descritores de
 * propriedade (getters, setters, propriedades não enumeráveis).
 */
export function shallowClone<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice() as T;
  }
  if (Buffer.isBuffer(value)) {
    return Buffer.from(value) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (value instanceof Map) {
    return new Map<unknown, unknown>(value) as T;
  }
  if (value instanceof Set) {
    return new Set<unknown>(value) as T;
  }
  return Object.create(
    Object.getPrototypeOf(value) as object | null,
    Object.getOwnPropertyDescriptors(value),
  ) as T;
}

/**
 * Cópia profunda: duplica o grafo inteiro de objetos alcançável a partir de
 * `value`, de modo que alterar a cópia nunca afeta o original.
 *
 * - Preserva a cadeia de protótipos, então instâncias de classe continuam com
 *   seus métodos (o `structuredClone` nativo devolveria objetos simples).
 * - Trata `Date`, `RegExp`, `Map`, `Set`, arrays, `ArrayBuffer` e typed arrays.
 * - Trata referências circulares e compartilhadas: cada objeto do original é
 *   copiado uma única vez, e toda referência a ele passa a apontar para a
 *   mesma cópia.
 * - Funções são mantidas por referência (são comportamento, não estado).
 * - `WeakMap`, `WeakSet`, `WeakRef` e `Promise` são mantidos por referência,
 *   porque o conteúdo deles não pode ser enumerado nem reconstruído.
 */
export function deepClone<T>(value: T): T {
  return cloneValue(value, new WeakMap<object, unknown>()) as T;
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof WeakRef ||
    value instanceof Promise
  ) {
    return value;
  }

  if (value instanceof Date) {
    return remember(seen, value, new Date(value.getTime()));
  }
  if (value instanceof RegExp) {
    const copy = new RegExp(value.source, value.flags);
    copy.lastIndex = value.lastIndex;
    return remember(seen, value, copy);
  }
  if (Buffer.isBuffer(value)) {
    return remember(seen, value, Buffer.from(value));
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    // Dados binários não contêm referências: o clone nativo já resolve.
    return remember(seen, value, structuredClone(value));
  }
  if (value instanceof Map) {
    const copy = remember(seen, value, new Map<unknown, unknown>());
    for (const [key, item] of value) {
      copy.set(cloneValue(key, seen), cloneValue(item, seen));
    }
    return copy;
  }
  if (value instanceof Set) {
    const copy = remember(seen, value, new Set<unknown>());
    for (const item of value) {
      copy.add(cloneValue(item, seen));
    }
    return copy;
  }
  if (Array.isArray(value)) {
    const copy = remember(seen, value, new Array<unknown>(value.length));
    // `forEach` pula posições vazias, então arrays esparsos continuam esparsos.
    value.forEach((item, index) => {
      copy[index] = cloneValue(item, seen);
    });
    return copy;
  }

  // Objetos literais e instâncias de classe. O registro em `seen` acontece
  // ANTES de descer nas propriedades: é isso que resolve a referência circular.
  const copy = remember(
    seen,
    value,
    Object.create(Object.getPrototypeOf(value) as object | null) as object,
  );
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      continue;
    }
    if ('value' in descriptor) {
      descriptor.value = cloneValue(descriptor.value, seen);
    }
    Object.defineProperty(copy, key, descriptor);
  }
  return copy;
}

function remember<C extends object>(seen: WeakMap<object, unknown>, original: object, copy: C): C {
  seen.set(original, copy);
  return copy;
}
