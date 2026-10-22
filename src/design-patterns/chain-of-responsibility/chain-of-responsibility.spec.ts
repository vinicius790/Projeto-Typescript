import { BalanceCheckHandler } from './balance-check.handler';
import { BaseTransactionHandler } from './base-transaction.handler';
import {
  PipelineExecutionContext,
  TransactionAuthorizationResult,
  TransactionRequest,
} from './chain-of-responsibility.types';
import { DailyLimitCheckHandler } from './daily-limit-check.handler';
import { FinalApprovalHandler } from './final-approval.handler';
import { FraudCheckHandler } from './fraud-check.handler';
import { TransactionPipeline, TransactionPipelineBuilder } from './transaction-pipeline';

describe('GoF Behavioral - Chain of Responsibility', () => {
  const baseRequest: TransactionRequest = {
    transactionId: 'TX-TEST-001',
    accountId: 'ACC-1234',
    amountInCents: 10000, // R$ 100,00
    currency: 'BRL',
    accountBalanceInCents: 50000, // R$ 500,00
    dailyLimitInCents: 100000, // R$ 1.000,00
    dailySpentInCents: 20000, // R$ 200,00
    customerRiskScore: 15,
  };

  describe('BalanceCheckHandler', () => {
    let handler: BalanceCheckHandler;

    beforeEach(() => {
      handler = new BalanceCheckHandler();
    });

    it('deve rejeitar transação se valor for menor ou igual a zero', async () => {
      const result = await handler.handle({ ...baseRequest, amountInCents: 0 });
      expect(result.authorized).toBe(false);
      expect(result.decision).toBe('REJECTED');
      expect(result.reason).toContain('Valor da transação inválido');
      expect(result.executedSteps).toHaveLength(1);
      expect(result.executedSteps[0].passed).toBe(false);
    });

    it('deve rejeitar transação se saldo for insuficiente', async () => {
      const result = await handler.handle({
        ...baseRequest,
        amountInCents: 60000,
        accountBalanceInCents: 50000,
      });
      expect(result.authorized).toBe(false);
      expect(result.decision).toBe('REJECTED');
      expect(result.reason).toContain('Saldo insuficiente');
      expect(result.executedSteps[0].details?.shortfallInCents).toBe(10000);
    });

    it('deve aprovar passo e delegar para o próximo quando saldo for suficiente', async () => {
      const nextMock = new FinalApprovalHandler();
      handler.setNext(nextMock);

      const result = await handler.handle(baseRequest);
      expect(result.authorized).toBe(true);
      expect(result.decision).toBe('APPROVED');
      expect(result.executedSteps).toHaveLength(2);
      expect(result.executedSteps[0].stepName).toBe('BalanceCheckHandler');
      expect(result.executedSteps[0].passed).toBe(true);
    });
  });

  describe('FraudCheckHandler', () => {
    let handler: FraudCheckHandler;

    beforeEach(() => {
      handler = new FraudCheckHandler();
    });

    it('deve rejeitar transação com risco crítico (>= 85)', async () => {
      const result = await handler.handle({ ...baseRequest, customerRiskScore: 92 });
      expect(result.authorized).toBe(false);
      expect(result.decision).toBe('REJECTED');
      expect(result.reason).toContain('motor antifraude');
      expect(result.executedSteps[0].details?.riskScore).toBe(92);
    });

    it('deve reter transação para análise manual em risco moderado (>= 70 e < 85)', async () => {
      const result = await handler.handle({ ...baseRequest, customerRiskScore: 75 });
      expect(result.authorized).toBe(false);
      expect(result.decision).toBe('FLAGGED_MANUAL_REVIEW');
      expect(result.reason).toContain('auditoria manual');
    });

    it('deve aprovar análise quando score de risco for seguro (< 70)', async () => {
      const result = await handler.handle({ ...baseRequest, customerRiskScore: 25 });
      expect(result.authorized).toBe(true);
      expect(result.decision).toBe('APPROVED');
      expect(result.executedSteps[0].passed).toBe(true);
    });
  });

  describe('DailyLimitCheckHandler', () => {
    let handler: DailyLimitCheckHandler;

    beforeEach(() => {
      handler = new DailyLimitCheckHandler();
    });

    it('deve rejeitar quando soma de gastos ultrapassa o limite diário', async () => {
      const result = await handler.handle({
        ...baseRequest,
        amountInCents: 50000,
        dailySpentInCents: 60000,
        dailyLimitInCents: 100000,
      });
      expect(result.authorized).toBe(false);
      expect(result.decision).toBe('REJECTED');
      expect(result.reason).toContain('excede o limite diário');
      expect(result.executedSteps[0].details?.overLimitInCents).toBe(10000);
    });

    it('deve aprovar passo quando valor está dentro da cota diária', async () => {
      const result = await handler.handle({
        ...baseRequest,
        amountInCents: 30000,
        dailySpentInCents: 20000,
        dailyLimitInCents: 100000,
      });
      expect(result.authorized).toBe(true);
      expect(result.executedSteps[0].passed).toBe(true);
      expect(result.executedSteps[0].details?.remainingLimitInCents).toBe(50000);
    });
  });

  describe('FinalApprovalHandler', () => {
    it('deve gerar código de liquidação e aprovar transação', async () => {
      const handler = new FinalApprovalHandler();
      const result = await handler.handle(baseRequest);

      expect(result.authorized).toBe(true);
      expect(result.decision).toBe('APPROVED');
      expect(result.authorizationCode).toMatch(/^AUTH-[A-Z0-9]{8}-[A-Z0-9]+$/);
      expect(result.executedSteps).toHaveLength(1);
      expect(result.executedSteps[0].stepName).toBe('FinalApprovalHandler');
    });
  });

  describe('TransactionPipeline & Integração da Cadeia Completa', () => {
    it('deve autorizar com sucesso pelo pipeline financeiro quando todas as regras forem satisfeitas', async () => {
      const chain = TransactionPipeline.createFinancialAuthorizationChain();
      const result = await chain.handle(baseRequest);

      expect(result.authorized).toBe(true);
      expect(result.decision).toBe('APPROVED');
      expect(result.authorizationCode).toBeDefined();
      expect(result.executedSteps).toHaveLength(4);
      expect(result.executedSteps.map((s) => s.stepName)).toEqual([
        'BalanceCheckHandler',
        'FraudCheckHandler',
        'DailyLimitCheckHandler',
        'FinalApprovalHandler',
      ]);
    });

    it('deve interromper precocemente no elo de saldo e não executar antifraude ou limite', async () => {
      const chain = TransactionPipeline.createFinancialAuthorizationChain();
      const result = await chain.handle({
        ...baseRequest,
        amountInCents: 90000,
        accountBalanceInCents: 20000,
      });

      expect(result.authorized).toBe(false);
      expect(result.executedSteps).toHaveLength(1);
      expect(result.executedSteps[0].stepName).toBe('BalanceCheckHandler');
    });

    it('deve interromper no elo antifraude após validar saldo com sucesso', async () => {
      const chain = TransactionPipeline.createFinancialAuthorizationChain();
      const result = await chain.handle({
        ...baseRequest,
        customerRiskScore: 90,
      });

      expect(result.authorized).toBe(false);
      expect(result.executedSteps).toHaveLength(2);
      expect(result.executedSteps[0].stepName).toBe('BalanceCheckHandler');
      expect(result.executedSteps[0].passed).toBe(true);
      expect(result.executedSteps[1].stepName).toBe('FraudCheckHandler');
      expect(result.executedSteps[1].passed).toBe(false);
    });

    it('deve interromper no elo de limite diário após validar saldo e antifraude', async () => {
      const chain = TransactionPipeline.createFinancialAuthorizationChain();
      const result = await chain.handle({
        ...baseRequest,
        amountInCents: 50000,
        dailySpentInCents: 80000,
        dailyLimitInCents: 100000,
      });

      expect(result.authorized).toBe(false);
      expect(result.executedSteps).toHaveLength(3);
      expect(result.executedSteps[0].passed).toBe(true);
      expect(result.executedSteps[1].passed).toBe(true);
      expect(result.executedSteps[2].stepName).toBe('DailyLimitCheckHandler');
      expect(result.executedSteps[2].passed).toBe(false);
    });

    it('deve suportar esteira customizada de agendamento', async () => {
      const chain = TransactionPipeline.createSchedulingAuthorizationChain();
      const result = await chain.handle(baseRequest);

      expect(result.authorized).toBe(true);
      expect(result.executedSteps).toHaveLength(3);
      expect(result.executedSteps.map((s) => s.stepName)).toEqual([
        'BalanceCheckHandler',
        'FraudCheckHandler',
        'FinalApprovalHandler',
      ]);
    });

    it('deve lançar erro se tentar criar pipeline sem nenhum handler', () => {
      expect(() => new TransactionPipelineBuilder().build()).toThrow(
        'A cadeia de responsabilidade precisa de ao menos um handler configurado.',
      );
    });
  });
});
