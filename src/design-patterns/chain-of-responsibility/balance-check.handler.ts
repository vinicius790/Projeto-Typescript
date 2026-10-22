import { BaseTransactionHandler } from './base-transaction.handler';
import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';

/**
 * Handler 1: Checagem de Saldo Disponível em Conta.
 * Valida se a conta de origem possui provisão suficiente para honrar a transação.
 */
export class BalanceCheckHandler extends BaseTransactionHandler {
  public readonly name = 'BalanceCheckHandler';

  protected async process(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    if (request.amountInCents <= 0) {
      this.recordStep(context, false, 'Valor da transação deve ser positivo e superior a zero.', {
        amountInCents: request.amountInCents,
      });

      return this.buildResult(
        request.transactionId,
        false,
        'REJECTED',
        'Valor da transação inválido.',
        context,
      );
    }

    if (request.accountBalanceInCents < request.amountInCents) {
      const shortfallInCents = request.amountInCents - request.accountBalanceInCents;
      this.recordStep(
        context,
        false,
        `Saldo insuficiente em conta. Faltam R$ ${(shortfallInCents / 100).toFixed(2)}.`,
        {
          balanceInCents: request.accountBalanceInCents,
          requiredInCents: request.amountInCents,
          shortfallInCents,
        },
      );

      return this.buildResult(
        request.transactionId,
        false,
        'REJECTED',
        'Saldo insuficiente para autorização da transação.',
        context,
      );
    }

    this.recordStep(
      context,
      true,
      `Saldo suficiente: Saldo R$ ${(request.accountBalanceInCents / 100).toFixed(2)} | Solicitado R$ ${(request.amountInCents / 100).toFixed(2)}.`,
      {
        balanceInCents: request.accountBalanceInCents,
        amountInCents: request.amountInCents,
        remainingBalanceInCents: request.accountBalanceInCents - request.amountInCents,
      },
    );

    return this.delegateNext(request, context);
  }
}
