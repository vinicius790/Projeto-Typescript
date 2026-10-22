import { BaseOrderState } from './base-order.state';
import { OrderStatusName } from './state.types';

/**
 * Estado 5: Cancelado (Estado Terminal).
 * A ordem foi abortada ou cancelada. Não aceita novas ações ou reativação.
 */
export class CancelledState extends BaseOrderState {
  public readonly name: OrderStatusName = 'Cancelado';

  public getAllowedActions(): string[] {
    return [];
  }
}
