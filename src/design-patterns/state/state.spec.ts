import { AwaitingPaymentState } from './awaiting-payment.state';
import { CancelledState } from './cancelled.state';
import { CompletedState } from './completed.state';
import { CreatedState } from './created.state';
import { InvalidStateTransitionException } from './invalid-state-transition.exception';
import { OrderContext } from './order.context';
import { ProcessingState } from './processing.state';

describe('GoF Behavioral - State Pattern', () => {
  let order: OrderContext;

  beforeEach(() => {
    order = new OrderContext({
      id: 'ORD-TEST-1',
      customerName: 'Lucas Ferreira',
      serviceName: 'Corte Social + Barba',
      amountInCents: 6500,
    });
  });

  describe('Estado: Criado (CreatedState)', () => {
    it('deve nascer no estado Criado com ações permitidas corretas', () => {
      expect(order.getStateName()).toBe('Criado');
      expect(order.getAllowedActions()).toEqual(['submitForPayment', 'cancel']);
    });

    it('deve transitar para AguardandoPagamento ao submeter pagamento', async () => {
      await order.submitForPayment('CARTAO_CREDITO');
      expect(order.getStateName()).toBe('AguardandoPagamento');
      expect(order.data.paymentMethod).toBe('CARTAO_CREDITO');
    });

    it('deve transitar para Cancelado ao invocar cancel', async () => {
      await order.cancel('Desistência antes do pagamento');
      expect(order.getStateName()).toBe('Cancelado');
      expect(order.data.cancelReason).toContain('Desistência');
    });

    it('deve lançar InvalidStateTransitionException ao tentar confirmar pagamento direto em Criado', async () => {
      await expect(order.confirmPayment('TX-123')).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });

    it('deve lançar InvalidStateTransitionException ao tentar concluir direto em Criado', async () => {
      await expect(order.complete()).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('Estado: AguardandoPagamento (AwaitingPaymentState)', () => {
    beforeEach(async () => {
      await order.submitForPayment('PIX');
    });

    it('deve refletir o estado e ações permitidas', () => {
      expect(order.getStateName()).toBe('AguardandoPagamento');
      expect(order.getAllowedActions()).toEqual(['confirmPayment', 'cancel']);
    });

    it('deve transitar para Processando ao confirmar pagamento com id de transação', async () => {
      await order.confirmPayment('TX-PIX-SUCCESS-99');
      expect(order.getStateName()).toBe('Processando');
      expect(order.data.transactionId).toBe('TX-PIX-SUCCESS-99');
    });

    it('deve lançar erro se tentar confirmar pagamento sem transactionId', async () => {
      await expect(order.confirmPayment('')).rejects.toThrow(
        'Identificador da transação é obrigatório',
      );
    });

    it('deve transitar para Cancelado se pagamento for cancelado', async () => {
      await order.cancel('PIX expirado por tempo limite');
      expect(order.getStateName()).toBe('Cancelado');
      expect(order.data.cancelReason).toContain('PIX expirado');
    });

    it('deve lançar exceção ao tentar completar sem processamento prévio', async () => {
      await expect(order.complete()).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('Estado: Processando (ProcessingState)', () => {
    beforeEach(async () => {
      await order.submitForPayment('PIX');
      await order.confirmPayment('TX-PIX-12345');
    });

    it('deve refletir o estado Processando e ações permitidas', () => {
      expect(order.getStateName()).toBe('Processando');
      expect(order.getAllowedActions()).toEqual(['startProcessing', 'complete', 'cancel']);
    });

    it('deve atribuir operador com startProcessing', async () => {
      await order.startProcessing('BARBER-007');
      expect(order.data.operatorId).toBe('BARBER-007');
      expect(order.getStateName()).toBe('Processando');
    });

    it('deve transitar para Concluido ao finalizar com sucesso', async () => {
      await order.complete('Corte executado com perfeição.');
      expect(order.getStateName()).toBe('Concluido');
      expect(order.data.completionNotes).toContain('Corte executado');
    });

    it('deve permitir cancelar durante o processamento com protocolo de estorno', async () => {
      await order.cancel('Cliente precisou sair por emergência');
      expect(order.getStateName()).toBe('Cancelado');
      expect(order.data.cancelReason).toContain('emergência');
    });

    it('deve rejeitar submissão de pagamento redundante', async () => {
      await expect(order.submitForPayment('BOLETO')).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('Estado: Concluido (CompletedState - Terminal)', () => {
    beforeEach(async () => {
      await order.submitForPayment('PIX');
      await order.confirmPayment('TX-PIX-12345');
      await order.complete('Finalizado');
    });

    it('deve ser estado terminal sem ações permitidas', () => {
      expect(order.getStateName()).toBe('Concluido');
      expect(order.getAllowedActions()).toEqual([]);
    });

    it('deve lançar exceção para qualquer ação subsequente', async () => {
      await expect(order.cancel('Tentativa tardia')).rejects.toThrow(
        InvalidStateTransitionException,
      );
      await expect(order.complete()).rejects.toThrow(
        InvalidStateTransitionException,
      );
      await expect(order.submitForPayment()).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('Estado: Cancelado (CancelledState - Terminal)', () => {
    beforeEach(async () => {
      await order.cancel('Cancelado no início');
    });

    it('deve ser estado terminal sem ações permitidas', () => {
      expect(order.getStateName()).toBe('Cancelado');
      expect(order.getAllowedActions()).toEqual([]);
    });

    it('deve lançar exceção para qualquer tentativa de reativação', async () => {
      await expect(order.submitForPayment()).rejects.toThrow(
        InvalidStateTransitionException,
      );
      await expect(order.confirmPayment('TX-000')).rejects.toThrow(
        InvalidStateTransitionException,
      );
      await expect(order.complete()).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('Histórico de Auditoria & Snapshot toJSON', () => {
    it('deve manter histórico detalhado de todas as transições com timestamps e motivos', async () => {
      await order.submitForPayment('PIX');
      await order.confirmPayment('TX-ABC');
      await order.complete('Pronto!');

      const history = order.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(4); // init + submit + confirm + complete

      expect(history[0].toState).toBe('Criado');
      expect(history[1].fromState).toBe('Criado');
      expect(history[1].toState).toBe('AguardandoPagamento');
      expect(history[2].fromState).toBe('AguardandoPagamento');
      expect(history[2].toState).toBe('Processando');
      expect(history[3].fromState).toBe('Processando');
      expect(history[3].toState).toBe('Concluido');

      const json = order.toJSON();
      expect(json.currentState).toBe('Concluido');
      expect(json.allowedActions).toEqual([]);
      expect(json.transactionId).toBe('TX-ABC');
      expect(json.history).toHaveLength(history.length);
    });
  });
});
