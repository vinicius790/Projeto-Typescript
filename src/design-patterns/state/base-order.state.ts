import { InvalidStateTransitionException } from './invalid-state-transition.exception';
import type { OrderContext } from './order.context';
import { OrderState } from './order-state.interface';
import { OrderStatusName } from './state.types';

/**
 * Estado Base Abstrato.
 * Lança InvalidStateTransitionException por padrão para quaisquer métodos não sobrescritos.
 */
export abstract class BaseOrderState implements OrderState {
  public abstract readonly name: OrderStatusName;
  public abstract getAllowedActions(): string[];

  public async submitForPayment(context: OrderContext, paymentMethod?: string): Promise<void> {
    throw new InvalidStateTransitionException(this.name, 'submitForPayment', this.getAllowedActions());
  }

  public async confirmPayment(context: OrderContext, transactionId: string): Promise<void> {
    throw new InvalidStateTransitionException(this.name, 'confirmPayment', this.getAllowedActions());
  }

  public async startProcessing(context: OrderContext, operatorId?: string): Promise<void> {
    throw new InvalidStateTransitionException(this.name, 'startProcessing', this.getAllowedActions());
  }

  public async complete(context: OrderContext, notes?: string): Promise<void> {
    throw new InvalidStateTransitionException(this.name, 'complete', this.getAllowedActions());
  }

  public async cancel(context: OrderContext, reason: string): Promise<void> {
    throw new InvalidStateTransitionException(this.name, 'cancel', this.getAllowedActions());
  }
}
