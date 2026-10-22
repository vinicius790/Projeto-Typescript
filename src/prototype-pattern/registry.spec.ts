import { Cloneable } from './cloneable';
import { PrototypeNotFoundError, PrototypeRegistry } from './registry';

class Template extends Cloneable {
  constructor(
    public title: string,
    public options: { color: string },
  ) {
    super();
  }
}

describe('Cloneable', () => {
  it('clone() devolve uma cópia profunda do mesmo tipo', () => {
    const original = new Template('a', { color: 'azul' });

    const copy = original.clone();
    copy.options.color = 'verde';

    expect(copy).toBeInstanceOf(Template);
    expect(copy).not.toBe(original);
    expect(original.options.color).toBe('azul');
  });

  it('shallowClone() devolve uma cópia rasa que compartilha os objetos aninhados', () => {
    const original = new Template('a', { color: 'azul' });

    const copy = original.shallowClone();
    copy.title = 'b';
    copy.options.color = 'verde';

    expect(copy).toBeInstanceOf(Template);
    expect(original.title).toBe('a');
    expect(original.options.color).toBe('verde');
  });
});

describe('PrototypeRegistry', () => {
  let registry: PrototypeRegistry<Template>;

  beforeEach(() => {
    registry = new PrototypeRegistry<Template>().register(
      'padrao',
      new Template('Padrão', { color: 'azul' }),
    );
  });

  it('cria objetos novos e independentes a cada chamada', () => {
    const first = registry.create('padrao');
    const second = registry.create('padrao');

    expect(first).toBeInstanceOf(Template);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.options).not.toBe(second.options);
  });

  it('não deixa alterações em um clone contaminarem o protótipo registrado', () => {
    const customized = registry.create('padrao');
    customized.title = 'Alterado';
    customized.options.color = 'vermelho';

    const fresh = registry.create('padrao');

    expect(fresh.title).toBe('Padrão');
    expect(fresh.options.color).toBe('azul');
  });

  it('não deixa alterações no objeto original, após o registro, contaminarem o catálogo', () => {
    const source = new Template('Fonte', { color: 'preto' });
    registry.register('fonte', source);

    source.options.color = 'branco';

    expect(registry.create('fonte').options.color).toBe('preto');
  });

  it('lança PrototypeNotFoundError para uma chave desconhecida', () => {
    expect(() => registry.create('inexistente')).toThrow(PrototypeNotFoundError);
    expect(() => registry.create('inexistente')).toThrow('"inexistente"');
  });

  it('informa as chaves registradas e permite remover', () => {
    registry.register('outro', new Template('Outro', { color: 'cinza' }));

    expect(registry.keys()).toEqual(['padrao', 'outro']);
    expect(registry.has('outro')).toBe(true);
    expect(registry.unregister('outro')).toBe(true);
    expect(registry.unregister('outro')).toBe(false);
    expect(registry.has('outro')).toBe(false);
  });

  it('substitui o protótipo quando a chave é registrada de novo', () => {
    registry.register('padrao', new Template('Novo padrão', { color: 'roxo' }));

    expect(registry.keys()).toEqual(['padrao']);
    expect(registry.create('padrao').title).toBe('Novo padrão');
  });
});
