/**
 * Tipos e Contratos de Domínio do Padrão Chain of Responsibility.
 *
 * Utilizado para pipeline sequencial e desacoplado de autorização financeira
 * e regras de negócio para transações e agendamentos.
 */

export interface TransactionRequest {
  transactionId: string;
  accountId: string;
  amountInCents: number;
  currency: string;
  accountBalanceInCents: number;
  dailyLimitInCents: number;
  dailySpentInCents: number;
  customerRiskScore: number; // Escala 0 a 100 (>= 80 é risco crítico)
  ipAddress?: string;
  deviceFingerprint?: string;
  metadata?: Record<string, unknown>;
}

export type TransactionDecision = 'APPROVED' | 'REJECTED' | 'FLAGGED_MANUAL_REVIEW';

export interface StepExecutionResult {
  stepName: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  executedAt: Date;
}

export interface TransactionAuthorizationResult {
  transactionId: string;
  authorized: boolean;
  decision: TransactionDecision;
  reason: string;
  authorizationCode?: string;
  executedSteps: StepExecutionResult[];
  totalProcessingTimeMs: number;
  finalizedAt: Date;
}

export interface PipelineExecutionContext {
  startTime: number;
  steps: StepExecutionResult[];
  metadata: Record<string, unknown>;
}
