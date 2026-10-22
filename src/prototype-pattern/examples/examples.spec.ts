import { ComponentWithBackReference, ConcretePrototype } from './circular-reference.example';
import { runAllExamples } from './index';

function createPrototype(): ConcretePrototype {
  const prototype = new ConcretePrototype(245, new Date('2024-06-15T12:00:00.000Z'));
  prototype.circularReference = new ComponentWithBackReference(prototype);
  return prototype;
}

describe('ConcretePrototype (exemplo de referência circular)', () => {
  it('leva o valor primitivo para o clone', () => {
    const original = createPrototype();

    const copy = original.clone();

    expect(copy.primitive).toBe(original.primitive);
  });

  it('clona o componente Date em vez de compartilhar', () => {
    const original = createPrototype();

    const copy = original.clone();

    expect(copy.component).not.toBe(original.component);
    expect(copy.component.getTime()).toBe(original.component.getTime());
  });

  it('clona o componente circular e o liga ao clone, não ao original', () => {
    const original = createPrototype();

    const copy = original.clone();

    expect(copy).toBeInstanceOf(ConcretePrototype);
    expect(copy.circularReference).toBeInstanceOf(ComponentWithBackReference);
    expect(copy.circularReference).not.toBe(original.circularReference);
    expect(copy.circularReference?.prototype).toBe(copy);
    expect(original.circularReference?.prototype).toBe(original);
  });
});

describe('exemplos executáveis', () => {
  it('não imprimem nada ao serem importados', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./index');
      });
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('rodam até o fim e demonstram o comportamento esperado', () => {
    const lines: string[] = [];

    runAllExamples((line) => lines.push(line));

    expect(lines.filter((line) => line.startsWith('FALHA'))).toEqual([]);
    expect(lines).toContain('Autor do original após editar a cópia rasa: Bruno');
    expect(lines).toContain('Cópia profunda compartilha o autor com o original: false');
    expect(lines).toContain('OK: a referência de volta do clone aponta para o próprio clone.');
    expect(lines).toContain('Novo clone após a personalização: quadrado azul de 10x10');
    expect(lines).toContain(
      'Chave desconhecida: Nenhum protótipo registrado com a chave "triângulo".',
    );
  });
});
