import { BaseOrderState } from './base-order.state';
import { CancelledState } from './cancelled.state';
import type { OrderContext } from './order.context';
import { ProcessingState } from './processing.state';
import { OrderStatusName } from './state.types';

/**
 * Estado 2: AguardandoPagamento.
 * Aguarda liquidação financeira pelo gateway de pagamento.
 */
export class AwaitingPaymentState extends BaseOrderState {
  public readonly name: OrderStatusName = 'AguardandoPagamento';

  public getAllowedActions(): string[] {
    return ['confirmPayment', 'cancel'];
  }

  public override async confirmPayment(
    context: OrderContext,
    transactionId: string,
  ): Promise<void> {
    if (!transactionId) {
      throw new Error('Identificador da transação é obrigatório para confirmar o pagamento.');
    }
    context.data.transactionId = transactionId;
    context.transitionTo(
      new ProcessingState(),
      'confirmPayment',
      `Pagamento validado com transação ${transactionId}.`,
    );
  }

  public override async cancel(context: OrderContext, reason: string): Promise<void> {
    context.data.cancelReason = reason || 'Pagamento expirado ou cancelado pelo usuário';
    context.transitionTo(
      new CancelledState(),
      'cancel',
      `Cancelado antes da liquidação: ${context.data.cancelReason}`,
    );
  }
}
