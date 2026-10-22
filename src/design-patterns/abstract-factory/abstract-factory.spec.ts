import type { AbstractFactory } from './abstract-factory';
import { FamilyFactory } from './abstract-factory';
import type { ThemeWidgets } from './theme-widgets';
import { renderLoginForm, themeFactory } from './theme-widgets';

describe('FamilyFactory', () => {
  type Shapes = { circle: { radius: number }; square: { side: number } };

  it('cria cada produto pela receita correspondente', () => {
    const factory = new FamilyFactory<Shapes>({
      circle: () => ({ radius: 1 }),
      square: () => ({ side: 2 }),
    });

    expect(factory.create('circle')).toEqual({ radius: 1 });
    expect(factory.create('square')).toEqual({ side: 2 });
  });

  it('devolve um produto novo a cada chamada', () => {
    const factory = new FamilyFactory<Shapes>({
      circle: () => ({ radius: 1 }),
      square: () => ({ side: 2 }),
    });

    expect(factory.create('circle')).not.toBe(factory.create('circle'));
  });

  it('informa os produtos que sabe criar', () => {
    const factory = new FamilyFactory<Shapes>({
      circle: () => ({ radius: 1 }),
      square: () => ({ side: 2 }),
    });

    expect(factory.kinds()).toEqual(['circle', 'square']);
  });
});

describe('temas (Abstract Factory)', () => {
  it.each(['light', 'dark'] as const)('a fábrica %s só produz widgets do seu tema', (theme) => {
    const factory = themeFactory(theme);

    expect(factory.create('button').theme).toBe(theme);
    expect(factory.create('checkbox').theme).toBe(theme);
  });

  it('o mesmo cliente gera formulários diferentes conforme a fábrica recebida', () => {
    expect(renderLoginForm(themeFactory('light'), true)).toEqual([
      '[x] Lembrar de mim',
      '[ Entrar ]',
    ]);
    expect(renderLoginForm(themeFactory('dark'), false)).toEqual([
      '( ) Lembrar de mim',
      '[# Entrar #]',
    ]);
  });

  it('o cliente aceita uma família nova sem ser alterado', () => {
    const plain: AbstractFactory<ThemeWidgets> = new FamilyFactory<ThemeWidgets>({
      button: () => ({ theme: 'light', render: (label) => label.toUpperCase() }),
      checkbox: () => ({
        theme: 'light',
        render: (label, checked) => `${label}=${checked ? 'sim' : 'não'}`,
      }),
    });

    expect(renderLoginForm(plain, true)).toEqual(['Lembrar de mim=sim', 'ENTRAR']);
  });
});
