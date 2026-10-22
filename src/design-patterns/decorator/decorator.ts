/**
 * Contrato de Domínio do Padrão GoF Decorator (Component & Base Decorator).
 *
 * O padrão Decorator agrega responsabilidades adicionais a um objeto dinamicamente.
 * Os decorators fornecem uma alternativa flexível ao uso de subclasses para extensão
 * de funcionalidade.
 */

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerEmail: string;
  items: OrderItem[];
  total: number;
  createdAt: Date;
}

export interface CreateOrderDto {
  customerEmail: string;
  items: OrderItem[];
}

/**
 * Interface Componente que define as operações que podem ser decoradas.
 */
export interface OrderService {
  createOrder(dto: CreateOrderDto): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  listOrders(): Promise<Order[]>;
}

/**
 * Componente Concreto: implementa a lógica de negócio essencial sem preocupações
 * transversais como medição de performance ou logging.
 */
export class BaseOrderService implements OrderService {
  private readonly orders = new Map<string, Order>();

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    if (!dto.customerEmail || dto.items.length === 0) {
      throw new Error('Pedido inválido: informe e-mail e ao menos um item.');
    }

    const total = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const order: Order = {
      id: `ord_${Math.random().toString(36).substring(2, 9)}`,
      customerEmail: dto.customerEmail,
      items: [...dto.items],
      total,
      createdAt: new Date(),
    };

    this.orders.set(order.id, order);
    return order;
  }

  async getOrderById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async listOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
}

/**
 * Decorator Base Abstrato: mantém uma referência ao objeto componente e delega todas
 * as chamadas para ele. As subclasses adicionam comportamento antes ou depois da delegação.
 */
export abstract class OrderServiceDecorator implements OrderService {
  constructor(protected readonly inner: OrderService) {}

  createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.inner.createOrder(dto);
  }

  getOrderById(id: string): Promise<Order | null> {
    return this.inner.getOrderById(id);
  }

  listOrders(): Promise<Order[]> {
    return this.inner.listOrders();
  }
}
