import type { Log } from '../log';
import { InvalidStateTransitionException } from './invalid-state-transition.exception';
import { OrderContext } from './order.context';

export function runStateExample(log: Log = console.log): void {
  log('--- State Pattern ---');

  // Cenário 1: Ciclo de vida feliz completo (Criado -> AguardandoPagamento -> Processando -> Concluido)
  const order = new OrderContext({
    id: 'ORD-STATE-001',
    customerName: 'Carlos Silveira',
    serviceName: 'Corte Degrade Premium + Barboterapia',
    amountInCents: 9500, // R$ 95,00
  });

  log(`[${order.data.id}] Estado Inicial: ${order.getStateName()} | Ações Permitidas: [${order.getAllowedActions().join(', ')}]`);

  order.submitForPayment('PIX').then(() => {
    log(`[${order.data.id}] Pós submitForPayment: ${order.getStateName()} | Método: ${order.data.paymentMethod}`);

    return order.confirmPayment('TX-PIX-998877');
  }).then(() => {
    log(`[${order.data.id}] Pós confirmPayment: ${order.getStateName()} | Transação: ${order.data.transactionId}`);

    return order.complete('Atendimento finalizado com satisfação máxima');
  }).then(() => {
    log(`[${order.data.id}] Pós complete: ${order.getStateName()} | Estado Final: Terminal (ações permitidas: ${order.getAllowedActions().length})`);
  });

  // Cenário 2: Tentativa de transição ilegal bloqueada pelo State
  const illegalOrder = new OrderContext({
    id: 'ORD-ILLEGAL-002',
    customerName: 'Mariana Duarte',
    serviceName: 'Design de Barba',
    amountInCents: 4500,
  });

  illegalOrder.complete('Tentando concluir direto sem pagar!').catch((err) => {
    if (err instanceof InvalidStateTransitionException) {
      log(`[${illegalOrder.data.id}] Transição bloqueada com sucesso: ${err.message}`);
    }
  });
}
