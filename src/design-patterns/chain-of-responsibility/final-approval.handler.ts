import { randomUUID } from 'node:crypto';
import { BaseTransactionHandler } from './base-transaction.handler';
import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';

/**
 * Handler 4: Autorização Final e Concessão de Token de Aprovação.
 * Elo terminal da esteira que chancela a operação e gera o código de liquidação.
 */
export class FinalApprovalHandler extends BaseTransactionHandler {
  public readonly name = 'FinalApprovalHandler';

  protected async process(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    const authCode = `AUTH-${randomUUID().substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    this.recordStep(
      context,
      true,
      `Autorização formal concedida com código de liquidação [${authCode}].`,
      {
        authorizationCode: authCode,
        amountInCents: request.amountInCents,
        currency: request.currency,
        accountId: request.accountId,
      },
    );

    return this.buildResult(
      request.transactionId,
      true,
      'APPROVED',
      'Transação autorizada com sucesso por todos os elos da esteira de validação.',
      context,
      authCode,
    );
  }
}
