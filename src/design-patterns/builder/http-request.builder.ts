import type { Builder } from './builder';
import { BuilderValidationError } from './builder';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Produto: a descrição imutável de uma requisição HTTP, pronta para ser enviada. */
export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Builder concreto. Cada método configura uma parte e devolve `this`, o que
 * permite encadear as chamadas. A validação fica concentrada em `build()`:
 * nenhum objeto `HttpRequest` inválido chega a existir.
 */
export class HttpRequestBuilder implements Builder<HttpRequest> {
  private method: HttpMethod = 'GET';
  private readonly headers = new Map<string, string>();
  private readonly query = new Map<string, string>();
  private body?: string;
  private timeoutMs = DEFAULT_TIMEOUT_MS;

  constructor(private url = '') {}

  setMethod(method: HttpMethod): this {
    this.method = method;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  /** Nomes de cabeçalho não diferenciam maiúsculas: repetir o nome substitui o valor. */
  addHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  addQuery(name: string, value: string | number | boolean): this {
    this.query.set(name, String(value));
    return this;
  }

  /** Define o corpo em JSON e o cabeçalho `content-type` correspondente. */
  setJsonBody(payload: unknown): this {
    this.body = JSON.stringify(payload);
    return this.addHeader('content-type', 'application/json');
  }

  setTimeout(timeoutMs: number): this {
    this.timeoutMs = timeoutMs;
    return this;
  }

  /**
   * Entrega o produto. O builder pode continuar sendo usado depois: cada
   * chamada devolve um objeto novo e congelado, independente dos anteriores.
   *
   * @throws BuilderValidationError com a lista de todos os problemas encontrados.
   */
  build(): HttpRequest {
    const problems: string[] = [];
    if (!URL.canParse(this.url)) {
      problems.push(`URL inválida: "${this.url}"`);
    }
    if (this.body !== undefined && (this.method === 'GET' || this.method === 'DELETE')) {
      problems.push(`requisição ${this.method} não pode ter corpo`);
    }
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      problems.push('o tempo limite deve ser um inteiro positivo');
    }
    if (problems.length > 0) {
      throw new BuilderValidationError(problems);
    }

    const url = new URL(this.url);
    for (const [name, value] of this.query) {
      url.searchParams.set(name, value);
    }
    return Object.freeze({
      method: this.method,
      url: url.toString(),
      headers: Object.freeze(Object.fromEntries(this.headers)),
      body: this.body,
      timeoutMs: this.timeoutMs,
    });
  }
}

// O "Diretor" do padrão: receitas prontas que escondem a sequência de passos.

/** Receita: `POST` com corpo JSON. */
export function buildJsonPost(url: string, payload: unknown): HttpRequest {
  return new HttpRequestBuilder(url)
    .setMethod('POST')
    .addHeader('Accept', 'application/json')
    .setJsonBody(payload)
    .build();
}

/** Receita: verificação de saúde, com tempo limite curto e sem cache. */
export function buildHealthCheck(url: string): HttpRequest {
  return new HttpRequestBuilder(url)
    .addHeader('Cache-Control', 'no-cache')
    .setTimeout(2_000)
    .build();
}
