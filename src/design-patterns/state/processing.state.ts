import { BaseOrderState } from './base-order.state';
import { CancelledState } from './cancelled.state';
import { CompletedState } from './completed.state';
import type { OrderContext } from './order.context';
import { OrderStatusName } from './state.types';

/**
 * Estado 3: Processando.
 * O pagamento foi confirmado e o serviço/ordem está em execução ou produção.
 */
export class ProcessingState extends BaseOrderState {
  public readonly name: OrderStatusName = 'Processando';

  public getAllowedActions(): string[] {
    return ['startProcessing', 'complete', 'cancel'];
  }

  public override async startProcessing(
    context: OrderContext,
    operatorId?: string,
  ): Promise<void> {
    if (operatorId) {
      context.data.operatorId = operatorId;
    }
  }

  public override async complete(context: OrderContext, notes?: string): Promise<void> {
    context.data.completionNotes = notes || 'Serviço executado com sucesso e entregue ao cliente.';
    context.transitionTo(
      new CompletedState(),
      'complete',
      context.data.completionNotes,
    );
  }

  public override async cancel(context: OrderContext, reason: string): Promise<void> {
    context.data.cancelReason = reason || 'Interrupção forçada durante a execução (estorno requerido)';
    context.transitionTo(
      new CancelledState(),
      'cancel',
      `Cancelado em fase de processamento com protocolo de estorno: ${context.data.cancelReason}`,
    );
  }
}
