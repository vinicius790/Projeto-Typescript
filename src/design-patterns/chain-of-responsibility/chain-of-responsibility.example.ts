import type { Log } from '../log';
import { TransactionRequest } from './chain-of-responsibility.types';
import { TransactionPipeline } from './transaction-pipeline';

export function runChainOfResponsibilityExample(log: Log = console.log): void {
  log('--- Chain of Responsibility ---');

  const chain = TransactionPipeline.createFinancialAuthorizationChain();

  // Cenário 1: Transação válida que percorre todos os elos com sucesso
  const validRequest: TransactionRequest = {
    transactionId: 'TX-OK-101',
    accountId: 'ACC-8831',
    amountInCents: 12000, // R$ 120,00
    currency: 'BRL',
    accountBalanceInCents: 50000, // R$ 500,00
    dailyLimitInCents: 100000, // R$ 1.000,00
    dailySpentInCents: 20000, // R$ 200,00
    customerRiskScore: 12,
  };

  chain.handle(validRequest).then((res) => {
    log(`[${res.transactionId}] Decisão: ${res.decision} | Autorização: ${res.authorizationCode}`);
    for (const step of res.executedSteps) {
      log(`  -> Passo [${step.stepName}]: ${step.passed ? 'APROVADO' : 'REPROVADO'} - ${step.message}`);
    }
  });

  // Cenário 2: Transação interrompida no primeiro elo (saldo insuficiente)
  const insufficientFundsRequest: TransactionRequest = {
    transactionId: 'TX-FAIL-SALDO',
    accountId: 'ACC-9942',
    amountInCents: 60000, // R$ 600,00
    currency: 'BRL',
    accountBalanceInCents: 15000, // R$ 150,00
    dailyLimitInCents: 100000,
    dailySpentInCents: 10000,
    customerRiskScore: 10,
  };

  chain.handle(insufficientFundsRequest).then((res) => {
    log(`[${res.transactionId}] Decisão: ${res.decision} | Motivo: ${res.reason}`);
  });
}
