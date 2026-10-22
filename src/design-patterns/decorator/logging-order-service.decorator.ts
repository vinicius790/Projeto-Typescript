import type { Log } from '../log';
import {
  CreateOrderDto,
  Order,
  OrderService,
  OrderServiceDecorator,
} from './decorator';

/**
 * Decorator Concreto de Logging.
 *
 * Registra entradas de métodos, parâmetros, tempo decorrido e resultados
 * ou exceções geradas, sem modificar o código do serviço base.
 */
export class LoggingOrderServiceDecorator extends OrderServiceDecorator {
  private readonly logs: string[] = [];

  constructor(
    inner: OrderService,
    private readonly logger: Log = (msg) => this.logs.push(msg),
  ) {
    super(inner);
  }

  getCapturedLogs(): string[] {
    return [...this.logs];
  }

  override async createOrder(dto: CreateOrderDto): Promise<Order> {
    const start = Date.now();
    this.logger(`[LOG] Iniciando createOrder para cliente="${dto.customerEmail}" com ${dto.items.length} itens.`);
    try {
      const order = await super.createOrder(dto);
      const elapsed = Date.now() - start;
      this.logger(`[LOG] createOrder concluído com sucesso: ID=${order.id}, total=R$${order.total} (${elapsed}ms).`);
      return order;
    } catch (error) {
      const elapsed = Date.now() - start;
      this.logger(`[LOG] Falha em createOrder (${elapsed}ms): ${(error as Error).message}`);
      throw error;
    }
  }

  override async getOrderById(id: string): Promise<Order | null> {
    const start = Date.now();
    this.logger(`[LOG] Buscando pedido ID="${id}".`);
    try {
      const order = await super.getOrderById(id);
      const elapsed = Date.now() - start;
      this.logger(
        `[LOG] getOrderById ID="${id}" finalizado: ${order ? 'encontrado' : 'não encontrado'} (${elapsed}ms).`,
      );
      return order;
    } catch (error) {
      const elapsed = Date.now() - start;
      this.logger(`[LOG] Falha em getOrderById ID="${id}" (${elapsed}ms): ${(error as Error).message}`);
      throw error;
    }
  }

  override async listOrders(): Promise<Order[]> {
    const start = Date.now();
    this.logger(`[LOG] Listando todos os pedidos.`);
    const orders = await super.listOrders();
    const elapsed = Date.now() - start;
    this.logger(`[LOG] listOrders concluído: ${orders.length} pedidos retornados (${elapsed}ms).`);
    return orders;
  }
}
