import { BaseTransactionHandler } from './base-transaction.handler';
import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';

/**
 * Handler 3: Verificação de Limite Diário de Transações.
 * Valida se a transação solicitada ultrapassa o limite diário acumulado estipulado pela conta.
 */
export class DailyLimitCheckHandler extends BaseTransactionHandler {
  public readonly name = 'DailyLimitCheckHandler';

  protected async process(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    const projectedSpentInCents = request.dailySpentInCents + request.amountInCents;

    if (projectedSpentInCents > request.dailyLimitInCents) {
      const overLimitInCents = projectedSpentInCents - request.dailyLimitInCents;
      this.recordStep(
        context,
        false,
        `Limite diário excedido. Gasto acumulado R$ ${(request.dailySpentInCents / 100).toFixed(2)} + R$ ${(request.amountInCents / 100).toFixed(2)} ultrapassa o teto de R$ ${(request.dailyLimitInCents / 100).toFixed(2)}.`,
        {
          dailyLimitInCents: request.dailyLimitInCents,
          dailySpentInCents: request.dailySpentInCents,
          amountInCents: request.amountInCents,
          projectedSpentInCents,
          overLimitInCents,
        },
      );

      return this.buildResult(
        request.transactionId,
        false,
        'REJECTED',
        `Transação excede o limite diário disponível em R$ ${(overLimitInCents / 100).toFixed(2)}.`,
        context,
      );
    }

    const remainingLimitInCents = request.dailyLimitInCents - projectedSpentInCents;
    this.recordStep(
      context,
      true,
      `Limite diário verificado com sucesso. Limite restante pós-operação: R$ ${(remainingLimitInCents / 100).toFixed(2)}.`,
      {
        dailyLimitInCents: request.dailyLimitInCents,
        currentSpentInCents: request.dailySpentInCents,
        projectedSpentInCents,
        remainingLimitInCents,
      },
    );

    return this.delegateNext(request, context);
  }
}
