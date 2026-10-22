import { AwaitingPaymentState } from './awaiting-payment.state';
import { BaseOrderState } from './base-order.state';
import { CancelledState } from './cancelled.state';
import type { OrderContext } from './order.context';
import { OrderStatusName } from './state.types';

/**
 * Estado 1: Criado.
 * Ordem recém-instanciada no sistema. Permite submeter para faturamento ou cancelar.
 */
export class CreatedState extends BaseOrderState {
  public readonly name: OrderStatusName = 'Criado';

  public getAllowedActions(): string[] {
    return ['submitForPayment', 'cancel'];
  }

  public override async submitForPayment(
    context: OrderContext,
    paymentMethod?: string,
  ): Promise<void> {
    context.data.paymentMethod = paymentMethod || 'PIX';
    context.transitionTo(
      new AwaitingPaymentState(),
      'submitForPayment',
      `Ordem enviada para pagamento via ${context.data.paymentMethod}.`,
    );
  }

  public override async cancel(context: OrderContext, reason: string): Promise<void> {
    context.data.cancelReason = reason || 'Cancelado pelo cliente antes do pagamento';
    context.transitionTo(
      new CancelledState(),
      'cancel',
      `Cancelado na etapa de criação: ${context.data.cancelReason}`,
    );
  }
}
