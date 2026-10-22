import type { Log } from '../log';
import type { ThemeName } from './theme-widgets';
import { renderLoginForm, themeFactory } from './theme-widgets';

export function runAbstractFactoryExample(log: Log = console.log): void {
  const themes: ThemeName[] = ['light', 'dark'];

  log('--- Abstract Factory ---');
  for (const theme of themes) {
    // O mesmo código cliente produz formulários diferentes: só a fábrica muda.
    const factory = themeFactory(theme);
    log(`Tema ${theme}: ${renderLoginForm(factory, theme === 'dark').join(' | ')}`);
  }

  const dark = themeFactory('dark');
  const sameFamily = dark.kinds().every((kind) => dark.create(kind).theme === 'dark');
  log(`Produtos da fábrica dark: ${dark.kinds().join(', ')}`);
  log(`Todos os produtos da fábrica dark são do tema dark: ${sameFamily}`);
}
