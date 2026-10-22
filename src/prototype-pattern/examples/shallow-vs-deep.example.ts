import { Cloneable } from '../cloneable';
import type { Log } from './circular-reference.example';

class Author {
  constructor(public name: string) {}
}

class Article extends Cloneable {
  readonly tags = new Set<string>();

  constructor(
    public title: string,
    public author: Author,
    public publishedAt: Date,
  ) {
    super();
  }
}

export function runShallowVsDeepExample(log: Log = console.log): void {
  const original = new Article('Padrões de projeto', new Author('Ana'), new Date('2024-01-15'));
  original.tags.add('typescript');

  const shallow = original.shallowClone();
  const deep = original.clone();

  // Alterar o autor da cópia rasa altera o original: o objeto é compartilhado.
  shallow.author.name = 'Bruno';
  // Alterar a cópia profunda não afeta ninguém.
  deep.author.name = 'Carla';
  deep.tags.add('prototype');

  log('--- Cópia rasa x cópia profunda ---');
  log(`Autor do original após editar a cópia rasa: ${original.author.name}`);
  log(`Autor da cópia profunda: ${deep.author.name}`);
  log(`Cópia rasa compartilha o autor com o original: ${shallow.author === original.author}`);
  log(`Cópia profunda compartilha o autor com o original: ${deep.author === original.author}`);
  log(`Tags do original: ${[...original.tags].join(', ')}`);
  log(`Tags da cópia profunda: ${[...deep.tags].join(', ')}`);
  log(`A cópia profunda continua sendo um Article: ${deep instanceof Article}`);
}
