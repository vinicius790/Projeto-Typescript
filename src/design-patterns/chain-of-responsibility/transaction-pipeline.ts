import { BalanceCheckHandler } from './balance-check.handler';
import { DailyLimitCheckHandler } from './daily-limit-check.handler';
import { FinalApprovalHandler } from './final-approval.handler';
import { FraudCheckHandler } from './fraud-check.handler';
import { TransactionHandler } from './transaction-handler.interface';

/**
 * Construtor Fluente para montar cadeias de responsabilidade dinamicamente.
 */
export class TransactionPipelineBuilder {
  private readonly handlers: TransactionHandler[] = [];

  public add(handler: TransactionHandler): this {
    this.handlers.push(handler);
    return this;
  }

  public build(): TransactionHandler {
    if (this.handlers.length === 0) {
      throw new Error('A cadeia de responsabilidade precisa de ao menos um handler configurado.');
    }

    for (let i = 0; i < this.handlers.length - 1; i++) {
      const current = this.handlers[i];
      const next = this.handlers[i + 1];
      if (current && next) {
        current.setNext(next);
      }
    }

    const first = this.handlers[0];
    if (!first) {
      throw new Error('A cadeia de responsabilidade precisa de ao menos um handler configurado.');
    }
    return first;
  }
}

/**
 * Factory utilitária para instanciação rápida de cadeias de autorização padrão.
 */
export class TransactionPipeline {
  public static builder(): TransactionPipelineBuilder {
    return new TransactionPipelineBuilder();
  }

  /**
   * Esteira corporativa completa de autorização financeira:
   * Checagem de Saldo -> Verificação de Fraude -> Verificação de Limite Diário -> Autorização Final
   */
  public static createFinancialAuthorizationChain(): TransactionHandler {
    return TransactionPipeline.builder()
      .add(new BalanceCheckHandler())
      .add(new FraudCheckHandler())
      .add(new DailyLimitCheckHandler())
      .add(new FinalApprovalHandler())
      .build();
  }

  /**
   * Esteira simplificada para agendamento de serviços:
   * Checagem de Saldo/Provisão -> Verificação de Fraude/Risco -> Autorização Final
   */
  public static createSchedulingAuthorizationChain(): TransactionHandler {
    return TransactionPipeline.builder()
      .add(new BalanceCheckHandler())
      .add(new FraudCheckHandler())
      .add(new FinalApprovalHandler())
      .build();
  }
}
