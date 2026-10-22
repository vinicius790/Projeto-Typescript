import {
  PipelineExecutionContext,
  StepExecutionResult,
  TransactionAuthorizationResult,
  TransactionDecision,
  TransactionRequest,
} from './chain-of-responsibility.types';
import { TransactionHandler } from './transaction-handler.interface';

/**
 * Classe Base Abstrata para Handlers da Cadeia de Responsabilidade.
 * Implementa o encadeamento e o gerenciamento de contexto de auditoria.
 */
export abstract class BaseTransactionHandler implements TransactionHandler {
  protected nextHandler: TransactionHandler | null = null;
  public abstract readonly name: string;

  public setNext(handler: TransactionHandler): TransactionHandler {
    this.nextHandler = handler;
    return handler;
  }

  public async handle(
    request: TransactionRequest,
    context?: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    const ctx = context ?? this.createInitialContext();
    return this.process(request, ctx);
  }

  protected abstract process(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult>;

  protected recordStep(
    context: PipelineExecutionContext,
    passed: boolean,
    message: string,
    details?: Record<string, unknown>,
  ): StepExecutionResult {
    const step: StepExecutionResult = {
      stepName: this.name,
      passed,
      message,
      details,
      executedAt: new Date(),
    };
    context.steps.push(step);
    return step;
  }

  protected delegateNext(
    request: TransactionRequest,
    context: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult> {
    if (this.nextHandler) {
      return this.nextHandler.handle(request, context);
    }

    // Se não houver próximo handler na cadeia, consideramos aprovado com os passos executados
    return Promise.resolve(
      this.buildResult(
        request.transactionId,
        true,
        'APPROVED',
        'Todos os handlers da esteira validaram com sucesso.',
        context,
      ),
    );
  }

  protected buildResult(
    transactionId: string,
    authorized: boolean,
    decision: TransactionDecision,
    reason: string,
    context: PipelineExecutionContext,
    authorizationCode?: string,
  ): TransactionAuthorizationResult {
    const totalProcessingTimeMs = Date.now() - context.startTime;
    return {
      transactionId,
      authorized,
      decision,
      reason,
      authorizationCode,
      executedSteps: [...context.steps],
      totalProcessingTimeMs,
      finalizedAt: new Date(),
    };
  }

  private createInitialContext(): PipelineExecutionContext {
    return {
      startTime: Date.now(),
      steps: [],
      metadata: {},
    };
  }
}
