import { BaseOrderState } from './base-order.state';
import { OrderStatusName } from './state.types';

/**
 * Estado 4: Concluido (Estado Terminal).
 * A ordem foi finalizada e entregue com êxito. Nenhuma transição adicional é permitida.
 */
export class CompletedState extends BaseOrderState {
  public readonly name: OrderStatusName = 'Concluido';

  public getAllowedActions(): string[] {
    return [];
  }
}
