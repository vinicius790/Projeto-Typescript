import { BuilderValidationError } from './builder';
import { buildHealthCheck, buildJsonPost, HttpRequestBuilder } from './http-request.builder';

describe('HttpRequestBuilder', () => {
  it('usa valores padrão quando só a URL é informada', () => {
    const request = new HttpRequestBuilder('https://exemplo.com/a').build();

    expect(request).toEqual({
      method: 'GET',
      url: 'https://exemplo.com/a',
      headers: {},
      body: undefined,
      timeoutMs: 30_000,
    });
  });

  it('monta o produto passo a passo, com chamadas encadeadas', () => {
    const request = new HttpRequestBuilder()
      .setUrl('https://exemplo.com/itens')
      .setMethod('PUT')
      .addHeader('Authorization', 'Bearer abc')
      .setJsonBody({ id: 1 })
      .setTimeout(1_000)
      .build();

    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual({
      authorization: 'Bearer abc',
      'content-type': 'application/json',
    });
    expect(request.body).toBe('{"id":1}');
    expect(request.timeoutMs).toBe(1_000);
  });

  it('acrescenta e codifica os parâmetros de consulta, preservando os da URL', () => {
    const request = new HttpRequestBuilder('https://exemplo.com/busca?ordem=asc')
      .addQuery('termo', 'café & pão')
      .addQuery('pagina', 2)
      .addQuery('ativo', true)
      .build();

    expect(request.url).toBe(
      'https://exemplo.com/busca?ordem=asc&termo=caf%C3%A9+%26+p%C3%A3o&pagina=2&ativo=true',
    );
  });

  it('trata nomes de cabeçalho sem diferenciar maiúsculas: o último valor vence', () => {
    const request = new HttpRequestBuilder('https://exemplo.com')
      .addHeader('Accept', 'text/html')
      .addHeader('ACCEPT', 'application/json')
      .build();

    expect(request.headers).toEqual({ accept: 'application/json' });
  });

  it('entrega um produto imutável', () => {
    const request = new HttpRequestBuilder('https://exemplo.com').addHeader('a', '1').build();

    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.headers)).toBe(true);
  });

  it('pode ser reutilizado: cada build() devolve um produto independente', () => {
    const builder = new HttpRequestBuilder('https://exemplo.com').addHeader('a', '1');

    const first = builder.build();
    const second = builder.addHeader('b', '2').setMethod('POST').build();

    expect(first).not.toBe(second);
    expect(first.method).toBe('GET');
    expect(first.headers).toEqual({ a: '1' });
    expect(second.headers).toEqual({ a: '1', b: '2' });
  });

  it('recusa a montagem e informa todos os problemas de uma vez', () => {
    const builder = new HttpRequestBuilder('sem protocolo').setJsonBody({ a: 1 }).setTimeout(0);
    let caught: unknown;

    try {
      builder.build();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BuilderValidationError);
    expect((caught as BuilderValidationError).problems).toEqual([
      'URL inválida: "sem protocolo"',
      'requisição GET não pode ter corpo',
      'o tempo limite deve ser um inteiro positivo',
    ]);
  });

  it('recusa URL vazia e tempo limite fracionário', () => {
    expect(() => new HttpRequestBuilder().build()).toThrow('URL inválida: ""');
    expect(() => new HttpRequestBuilder('https://exemplo.com').setTimeout(1.5).build()).toThrow(
      'inteiro positivo',
    );
  });

  it('aceita corpo em POST e PATCH, mas não em DELETE', () => {
    const builder = new HttpRequestBuilder('https://exemplo.com').setJsonBody([1]);

    expect(builder.setMethod('POST').build().body).toBe('[1]');
    expect(builder.setMethod('PATCH').build().body).toBe('[1]');
    expect(() => builder.setMethod('DELETE').build()).toThrow('DELETE não pode ter corpo');
  });
});

describe('receitas (Diretor)', () => {
  it('buildJsonPost monta um POST com corpo e cabeçalhos JSON', () => {
    const request = buildJsonPost('https://exemplo.com/itens', { nome: 'Caderno' });

    expect(request.method).toBe('POST');
    expect(request.body).toBe('{"nome":"Caderno"}');
    expect(request.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
    });
  });

  it('buildHealthCheck monta um GET curto e sem cache', () => {
    const request = buildHealthCheck('https://exemplo.com/health');

    expect(request.method).toBe('GET');
    expect(request.timeoutMs).toBe(2_000);
    expect(request.headers).toEqual({ 'cache-control': 'no-cache' });
    expect(request.body).toBeUndefined();
  });

  it('propaga o erro de validação do builder', () => {
    expect(() => buildHealthCheck('nada')).toThrow(BuilderValidationError);
  });
});
