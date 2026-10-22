import { BaseTransactionHandler } from './base-transaction.handler';
import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';

/**
 * Handler 2: Verificação de Fraude e Análise de Risco.
 * Avalia o escore de risco do cliente, anomalias e indicadores de fraude.
 */
export class FraudCheckHandler extends BaseTransactionHandler {
  public readonly name = 'FraudCheckHandler';

  private static readonly CRITICAL_RISK_THRESHOLD = 85;
  private static readonly MODERATE_RISK_THRESHOLD = 70;

  protected async process(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    const { customerRiskScore } = request;

    if (customerRiskScore >= FraudCheckHandler.CRITICAL_RISK_THRESHOLD) {
      this.recordStep(
        context,
        false,
        `Transação bloqueada: escore de risco crítico (${customerRiskScore}/100) excede o teto permitido de ${FraudCheckHandler.CRITICAL_RISK_THRESHOLD}.`,
        {
          riskScore: customerRiskScore,
          threshold: FraudCheckHandler.CRITICAL_RISK_THRESHOLD,
          actionTaken: 'REJECT_FRAUD',
        },
      );

      return this.buildResult(
        request.transactionId,
        false,
        'REJECTED',
        `Transação rejeitada pelo motor antifraude devido a alto índice de suspeita (${customerRiskScore}/100).`,
        context,
      );
    }

    if (customerRiskScore >= FraudCheckHandler.MODERATE_RISK_THRESHOLD) {
      this.recordStep(
        context,
        false,
        `Transação retida para mesa de análise humana (Escore: ${customerRiskScore}/100).`,
        {
          riskScore: customerRiskScore,
          threshold: FraudCheckHandler.MODERATE_RISK_THRESHOLD,
          actionTaken: 'FLAG_MANUAL_REVIEW',
        },
      );

      return this.buildResult(
        request.transactionId,
        false,
        'FLAGGED_MANUAL_REVIEW',
        `Transação retida preventivamente para auditoria manual de segurança (Score: ${customerRiskScore}/100).`,
        context,
      );
    }

    this.recordStep(
      context,
      true,
      `Análise antifraude aprovada com escore seguro (${customerRiskScore}/100).`,
      {
        riskScore: customerRiskScore,
        status: 'CLEARED',
      },
    );

    return this.delegateNext(request, context);
  }
}
