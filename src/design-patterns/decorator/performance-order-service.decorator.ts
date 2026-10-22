import {
  CreateOrderDto,
  Order,
  OrderService,
  OrderServiceDecorator,
} from './decorator';

export interface OperationMetric {
  callCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  slowCallsCount: number;
}

/**
 * Decorator Concreto de Medição de Performance & Telemetria.
 *
 * Mede com alta precisão (performance.now) o tempo de execução de cada método,
 * computa médias, mínimos, máximos e contabiliza chamadas lentas que excedem o limiar.
 */
export class PerformanceOrderServiceDecorator extends OrderServiceDecorator {
  private readonly metrics: Map<string, OperationMetric> = new Map();
  private readonly slowThresholdMs: number;

  constructor(inner: OrderService, slowThresholdMs = 50) {
    super(inner);
    this.slowThresholdMs = slowThresholdMs;
  }

  private recordMeasurement(operation: string, durationMs: number): void {
    const current = this.metrics.get(operation) || {
      callCount: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      slowCallsCount: 0,
    };

    current.callCount += 1;
    current.totalDurationMs += durationMs;
    current.avgDurationMs = parseFloat((current.totalDurationMs / current.callCount).toFixed(3));
    current.minDurationMs = Math.min(current.minDurationMs, durationMs);
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);

    if (durationMs >= this.slowThresholdMs) {
      current.slowCallsCount += 1;
    }

    this.metrics.set(operation, current);
  }

  getMetrics(): Record<string, OperationMetric> {
    const result: Record<string, OperationMetric> = {};
    for (const [key, val] of this.metrics.entries()) {
      result[key] = { ...val };
    }
    return result;
  }

  resetMetrics(): void {
    this.metrics.clear();
  }

  override async createOrder(dto: CreateOrderDto): Promise<Order> {
    const t0 = performance.now();
    try {
      return await super.createOrder(dto);
    } finally {
      const duration = performance.now() - t0;
      this.recordMeasurement('createOrder', duration);
    }
  }

  override async getOrderById(id: string): Promise<Order | null> {
    const t0 = performance.now();
    try {
      return await super.getOrderById(id);
    } finally {
      const duration = performance.now() - t0;
      this.recordMeasurement('getOrderById', duration);
    }
  }

  override async listOrders(): Promise<Order[]> {
    const t0 = performance.now();
    try {
      return await super.listOrders();
    } finally {
      const duration = performance.now() - t0;
      this.recordMeasurement('listOrders', duration);
    }
  }
}
