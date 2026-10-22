import type { OrderContext } from './order.context';
import { OrderStatusName } from './state.types';

/**
 * Interface do Padrão State.
 * Cada classe concreta de estado implementa as ações permitidas ou lança exceção para as inválidas.
 */
export interface OrderState {
  readonly name: OrderStatusName;
  getAllowedActions(): string[];

  submitForPayment(context: OrderContext, paymentMethod?: string): Promise<void>;
  confirmPayment(context: OrderContext, transactionId: string): Promise<void>;
  startProcessing(context: OrderContext, operatorId?: string): Promise<void>;
  complete(context: OrderContext, notes?: string): Promise<void>;
  cancel(context: OrderContext, reason: string): Promise<void>;
}
