/**
 * Contrato e barramento tipado para Eventos de Domínio (Observer Pattern).
 * Fornece pub/sub fortemente tipado, histórico de eventos e desacoplamento
 * total entre produtores e consumidores de eventos de domínio.
 */

export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  readonly eventId: string;
  readonly eventName: TName;
  readonly occurredOn: Date;
  readonly payload: TPayload;
  readonly correlationId?: string;
}

export type DomainEventHandler<TPayload> = (
  event: DomainEvent<string, TPayload>,
) => void | Promise<void>;

export type WildcardDomainEventHandler = (
  event: DomainEvent<string, unknown>,
) => void | Promise<void>;

export type Unsubscribe = () => void;

/**
 * Mapa central de eventos de domínio da aplicação.
 * Pode ser estendido por declaração de tipo.
 */
export type DefaultDomainEventMap = {
  'prototype.created': { id: number; name: string; primitive: number; actorId: number };
  'prototype.cloned': { sourceId: number; newId: number; name: string; actorId: number };
  'prototype.updated': { id: number; version: number; actorId: number };
  'prototype.deleted': { id: number };
  'prototype.restored': { id: number; version: number; actorId: number };
  'fine.calculated': { strategy: string; originalAmount: number; totalFine: number; overdueDays: number };
  'order.state_transitioned': { orderId: string; fromState: string; toState: string; action: string };
  'user.registered': { userId: number; email: string; role: string };
};

/**
 * Implementação concreta e fortemente tipada do Barramento de Eventos de Domínio.
 */
export class TypedDomainEventBus<TEventMap extends object = DefaultDomainEventMap> {
  private readonly listeners = new Map<keyof TEventMap, Set<DomainEventHandler<any>>>();
  private readonly wildcardListeners = new Set<WildcardDomainEventHandler>();
  private readonly eventHistory: DomainEvent<any, any>[] = [];
  private readonly maxHistorySize: number;

  constructor(options?: { maxHistorySize?: number }) {
    this.maxHistorySize = options?.maxHistorySize ?? 500;
  }

  /**
   * Inscreve um ouvinte para um tipo específico de evento de domínio.
   */
  subscribe<K extends keyof TEventMap>(
    eventName: K,
    handler: DomainEventHandler<TEventMap[K]>,
  ): Unsubscribe {
    let handlers = this.listeners.get(eventName);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(eventName, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
      if (handlers && handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  /**
   * Inscreve um ouvinte coringa (wildcard) que recebe TODOS os eventos de domínio.
   */
  subscribeAll(handler: WildcardDomainEventHandler): Unsubscribe {
    this.wildcardListeners.add(handler);
    return () => {
      this.wildcardListeners.delete(handler);
    };
  }

  /**
   * Publica um evento de domínio assincronamente, aguardando todos os handlers.
   * Erros em handlers individuais são capturados para não interromper outros ouvintes.
   */
  async publish<K extends keyof TEventMap>(
    eventName: K,
    payload: TEventMap[K],
    metadata?: { correlationId?: string; eventId?: string },
  ): Promise<DomainEvent<K & string, TEventMap[K]>> {
    const event: DomainEvent<K & string, TEventMap[K]> = {
      eventId: metadata?.eventId ?? this.generateId(),
      eventName: eventName as K & string,
      occurredOn: new Date(),
      payload,
      correlationId: metadata?.correlationId,
    };

    this.recordHistory(event);

    const specificHandlers = this.listeners.get(eventName);
    const promises: Promise<void>[] = [];

    if (specificHandlers) {
      for (const handler of Array.from(specificHandlers)) {
        promises.push(
          Promise.resolve()
            .then(() => handler(event))
            .catch((err) => {
              // Mantém isolamento: falha em um handler não quebra outros
              console.error(`[DomainEventBus] Erro ao processar evento ${String(eventName)}:`, err);
            }),
        );
      }
    }

    for (const wildcard of Array.from(this.wildcardListeners)) {
      promises.push(
        Promise.resolve()
          .then(() => wildcard(event))
          .catch((err) => {
            console.error(`[DomainEventBus] Erro em wildcard handler para ${String(eventName)}:`, err);
          }),
      );
    }

    await Promise.all(promises);
    return event;
  }

  /**
   * Publica um evento de forma síncrona sem aguardar Promises.
   */
  publishSync<K extends keyof TEventMap>(
    eventName: K,
    payload: TEventMap[K],
    metadata?: { correlationId?: string; eventId?: string },
  ): DomainEvent<K & string, TEventMap[K]> {
    const event: DomainEvent<K & string, TEventMap[K]> = {
      eventId: metadata?.eventId ?? this.generateId(),
      eventName: eventName as K & string,
      occurredOn: new Date(),
      payload,
      correlationId: metadata?.correlationId,
    };

    this.recordHistory(event);

    const specificHandlers = this.listeners.get(eventName);
    if (specificHandlers) {
      for (const handler of Array.from(specificHandlers)) {
        try {
          const res = handler(event);
          if (res instanceof Promise) {
            res.catch((err) =>
              console.error(`[DomainEventBus] Erro assíncrono em evento ${String(eventName)}:`, err),
            );
          }
        } catch (err) {
          console.error(`[DomainEventBus] Erro síncrono em evento ${String(eventName)}:`, err);
        }
      }
    }

    for (const wildcard of Array.from(this.wildcardListeners)) {
      try {
        const res = wildcard(event);
        if (res instanceof Promise) {
          res.catch((err) =>
            console.error(`[DomainEventBus] Erro assíncrono em wildcard para ${String(eventName)}:`, err),
          );
        }
      } catch (err) {
        console.error(`[DomainEventBus] Erro síncrono em wildcard para ${String(eventName)}:`, err);
      }
    }

    return event;
  }

  /**
   * Retorna o histórico recente de eventos publicados.
   */
  getHistory(eventName?: string): DomainEvent<any, any>[] {
    if (eventName) {
      return this.eventHistory.filter((e) => e.eventName === eventName);
    }
    return [...this.eventHistory];
  }

  /**
   * Limpa o histórico em memória.
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Quantidade de tipos de eventos com ouvintes ativos.
   */
  get activeEventTypesCount(): number {
    return this.listeners.size;
  }

  /**
   * Quantidade de ouvintes coringa.
   */
  get wildcardListenersCount(): number {
    return this.wildcardListeners.size;
  }

  private recordHistory(event: DomainEvent<any, any>): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private generateId(): string {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/** Instância singleton global padrão para uso no domínio da aplicação */
export const domainEventBus = new TypedDomainEventBus<DefaultDomainEventMap>();
