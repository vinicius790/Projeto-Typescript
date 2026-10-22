import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';

/**
 * Interface do Handler para o padrão Chain of Responsibility.
 * Cada elemento da cadeia pode processar a requisição e/ou delegar para o próximo.
 */
export interface TransactionHandler {
  /**
   * Define o próximo elo na corrente de execução.
   */
  setNext(handler: TransactionHandler): TransactionHandler;

  /**
   * Executa a regra de validação do handler atual.
   * Se for bem-sucedido e houver próximo handler, delega adiante.
   * Se falhar ou for o elo terminal, devolve o resultado final consolidado.
   */
  handle(
    request: TransactionRequest,
    context?: PipelineExecutionContext,
  ): Promise<TransactionAuthorizationResult>;
}
