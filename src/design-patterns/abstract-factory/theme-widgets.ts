import type { AbstractFactory } from './abstract-factory';
import { FamilyFactory } from './abstract-factory';

// Interfaces dos produtos: é só isto que o cliente conhece.

export interface Button {
  readonly theme: ThemeName;
  render(label: string): string;
}

export interface Checkbox {
  readonly theme: ThemeName;
  render(label: string, checked: boolean): string;
}

export type ThemeName = 'light' | 'dark';

/** A família de produtos: todo tema precisa oferecer os dois. */
export type ThemeWidgets = {
  button: Button;
  checkbox: Checkbox;
};

class LightButton implements Button {
  readonly theme = 'light';

  render(label: string): string {
    return `[ ${label} ]`;
  }
}

class LightCheckbox implements Checkbox {
  readonly theme = 'light';

  render(label: string, checked: boolean): string {
    return `${checked ? '[x]' : '[ ]'} ${label}`;
  }
}

class DarkButton implements Button {
  readonly theme = 'dark';

  render(label: string): string {
    return `[# ${label} #]`;
  }
}

class DarkCheckbox implements Checkbox {
  readonly theme = 'dark';

  render(label: string, checked: boolean): string {
    return `${checked ? '(#)' : '( )'} ${label}`;
  }
}

/** Fábricas concretas: uma por família. */
const themes: Record<ThemeName, FamilyFactory<ThemeWidgets>> = {
  light: new FamilyFactory<ThemeWidgets>({
    button: () => new LightButton(),
    checkbox: () => new LightCheckbox(),
  }),
  dark: new FamilyFactory<ThemeWidgets>({
    button: () => new DarkButton(),
    checkbox: () => new DarkCheckbox(),
  }),
};

export function themeFactory(name: ThemeName): FamilyFactory<ThemeWidgets> {
  return themes[name];
}

/**
 * Cliente: monta um formulário recebendo apenas a fábrica abstrata. Como todos
 * os widgets vêm da mesma fábrica, é impossível misturar temas por engano.
 */
export function renderLoginForm(
  factory: AbstractFactory<ThemeWidgets>,
  rememberMe: boolean,
): string[] {
  return [
    factory.create('checkbox').render('Lembrar de mim', rememberMe),
    factory.create('button').render('Entrar'),
  ];
}
