import type { Log } from '../log';
import { BuilderValidationError } from './builder';
import { buildJsonPost, HttpRequestBuilder } from './http-request.builder';

export function runBuilderExample(log: Log = console.log): void {
  const search = new HttpRequestBuilder('https://api.exemplo.com/produtos')
    .addQuery('categoria', 'livros')
    .addQuery('pagina', 2)
    .addHeader('Accept', 'application/json')
    .setTimeout(5_000)
    .build();
  const creation = buildJsonPost('https://api.exemplo.com/produtos', { nome: 'Caderno' });

  log('--- Builder ---');
  log(`Passo a passo: ${search.method} ${search.url} (limite de ${search.timeoutMs} ms)`);
  log(`Receita pronta: ${creation.method} ${creation.url} com corpo ${creation.body}`);
  log(`Cabeçalhos da receita: ${Object.keys(creation.headers).join(', ')}`);
  log(`O produto é imutável: ${Object.isFrozen(search)}`);

  try {
    new HttpRequestBuilder('endereço inválido').setJsonBody({}).build();
  } catch (error) {
    if (!(error instanceof BuilderValidationError)) {
      throw error;
    }
    log(`Montagem recusada: ${error.problems.join('; ')}`);
  }
}
