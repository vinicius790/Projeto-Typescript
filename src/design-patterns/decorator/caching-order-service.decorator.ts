import {
  CreateOrderDto,
  Order,
  OrderService,
  OrderServiceDecorator,
} from './decorator';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * Decorator Concreto de Cache.
 *
 * Armazena em memória os pedidos consultados por ID para evitar operações
 * repetidas no repositório de persistência.
 */
export class CachingOrderServiceDecorator extends OrderServiceDecorator {
  private readonly cache = new Map<string, { order: Order; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(
    inner: OrderService,
    private readonly ttlMs = 60_000,
  ) {
    super(inner);
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  override async getOrderById(id: string): Promise<Order | null> {
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      this.hits += 1;
      return cached.order;
    }

    this.misses += 1;
    const order = await super.getOrderById(id);
    if (order) {
      this.cache.set(id, { order, expiresAt: Date.now() + this.ttlMs });
    }
    return order;
  }

  override async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await super.createOrder(dto);
    // Adiciona o novo pedido ao cache imediatamente
    this.cache.set(order.id, { order, expiresAt: Date.now() + this.ttlMs });
    return order;
  }
}
