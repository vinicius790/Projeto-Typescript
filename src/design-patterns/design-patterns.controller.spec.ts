import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DesignPatternsController } from './design-patterns.controller';

describe('DesignPatternsController', () => {
  let controller: DesignPatternsController;

  beforeEach(() => {
    controller = new DesignPatternsController();
  });

  it('retorna o catálogo completo de padrões de projeto (9 padrões)', () => {
    const catalog = controller.getCatalog();
    expect(catalog.total).toBe(9);
    expect(catalog.patterns.map((p) => p.name)).toEqual(
      expect.arrayContaining([
        'Prototype',
        'Builder',
        'Factory Method',
        'Abstract Factory',
        'Observer',
        'Strategy',
        'Adapter',
        'Decorator',
        'Chain of Responsibility',
        'State',
      ]),
    );
  });

  it('processa pagamento via endpoint do adapter', async () => {
    const response = await controller.processPayment({
      provider: 'stripe',
      orderId: 'PED-777',
      amountInCents: 8500,
      currency: 'BRL',
      customerEmail: 'api@teste.com',
    });

    expect(response.pattern).toBe('GoF Structural - Adapter');
    expect(response.result.provider).toBe('Stripe');
    expect(response.result.status).toBe('PAID');
  });

  it('retorna provedores suportados no endpoint de adapter', () => {
    const info = controller.getAdapterProviders();
    expect(info.supportedProviders).toContain('stripe');
    expect(info.supportedProviders).toContain('paypal');
    expect(info.supportedProviders).toContain('mercadopago');
  });

  it('cria pedido e devolve telemetria no endpoint do decorator', async () => {
    const response = await controller.createOrder({
      customerEmail: 'cliente@teste.com',
      items: [{ name: 'Curso NestJS', quantity: 1, unitPrice: 299 }],
    });

    expect(response.pattern).toBe('GoF Structural - Decorator');
    expect(response.order.total).toBe(299);
    expect(response.telemetry.metrics.createOrder.callCount).toBe(1);
    expect(response.telemetry.recentLogs.length).toBeGreaterThan(0);
  });

  it('lista pedidos e busca pedido com hit de cache', async () => {
    const created = await controller.createOrder({
      customerEmail: 'cliente2@teste.com',
      items: [{ name: 'Livro TypeScript', quantity: 2, unitPrice: 75 }],
    });

    const listRes = await controller.listOrders();
    expect(listRes.total).toBeGreaterThanOrEm;
    expect(listRes.total).toBeGreaterThanOrEqual(1);

    const getRes = await controller.getOrder(created.order.id);
    expect(getRes.order?.id).toBe(created.order.id);
    expect(getRes.cacheStats.size).toBeGreaterThan(0);
  });

  it('retorna métricas de performance globais do controller', () => {
    const metrics = controller.getPerformanceMetrics();
    expect(metrics.pattern).toBe('GoF Structural - Decorator');
    expect(metrics.metrics).toBeDefined();
  });

  describe('Chain of Responsibility Endpoints', () => {
    it('deve autorizar transação financeira completa via POST chain/authorize', async () => {
      const response = await controller.authorizeTransaction({
        accountId: 'ACC-883',
        amountInCents: 15000,
        currency: 'BRL',
        accountBalanceInCents: 80000,
        dailyLimitInCents: 200000,
        dailySpentInCents: 30000,
        customerRiskScore: 10,
        pipelineType: 'financial',
      });

      expect(response.pattern).toBe('GoF Behavioral - Chain of Responsibility');
      expect(response.result.authorized).toBe(true);
      expect(response.result.decision).toBe('APPROVED');
      expect(response.result.authorizationCode).toBeDefined();
      expect(response.result.executedSteps).toHaveLength(4);
    });

    it('deve rejeitar transação e parar no primeiro handler por saldo insuficiente', async () => {
      const response = await controller.authorizeTransaction({
        accountId: 'ACC-883',
        amountInCents: 50000,
        currency: 'BRL',
        accountBalanceInCents: 10000,
        dailyLimitInCents: 200000,
        dailySpentInCents: 0,
        customerRiskScore: 5,
        pipelineType: 'financial',
      });

      expect(response.result.authorized).toBe(false);
      expect(response.result.decision).toBe('REJECTED');
      expect(response.result.executedSteps).toHaveLength(1);
    });

    it('deve retornar estrutura descritiva da esteira via GET chain/pipeline', () => {
      const pipelineInfo = controller.getChainPipeline();
      expect(pipelineInfo.pattern).toBe('GoF Behavioral - Chain of Responsibility');
      expect(pipelineInfo.financialPipeline).toHaveLength(4);
      expect(pipelineInfo.schedulingPipeline).toHaveLength(3);
    });
  });

  describe('State Pattern Endpoints', () => {
    it('deve criar nova ordem no estado Criado via POST state/orders', () => {
      const created = controller.createStateOrder({
        customerName: 'Mariana Lima',
        serviceName: 'Corte Degradê Navalhado',
        amountInCents: 6000,
      });

      expect(created.pattern).toBe('GoF Behavioral - State Pattern');
      expect(created.order.currentState).toBe('Criado');
      expect(created.order.allowedActions).toEqual(['submitForPayment', 'cancel']);
      expect(created.order.id).toBeDefined();
    });

    it('deve listar ordens via GET state/orders e buscar por ID via GET state/orders/:id', () => {
      const list = controller.listStateOrders();
      expect(list.total).toBeGreaterThanOrEqual(1);

      const firstId = list.orders[0].id;
      const single = controller.getStateOrder(firstId);
      expect(single.order.id).toBe(firstId);
    });

    it('deve lançar NotFoundException ao buscar ordem inexistente', () => {
      expect(() => controller.getStateOrder('ORD-INEXISTENTE-999')).toThrow(
        NotFoundException,
      );
    });

    it('deve executar fluxo completo de transição de estados com sucesso', async () => {
      const created = controller.createStateOrder({
        customerName: 'Guilherme Santos',
        serviceName: 'Barboterapia Completa',
        amountInCents: 4500,
      });
      const orderId = created.order.id;

      // 1. Criado -> submit_payment -> AguardandoPagamento
      const trans1 = await controller.transitionState(orderId, {
        action: 'submit_payment',
        paymentMethod: 'PIX',
      });
      expect(trans1.currentState).toBe('AguardandoPagamento');

      // 2. AguardandoPagamento -> confirm_payment -> Processando
      const trans2 = await controller.transitionState(orderId, {
        action: 'confirm_payment',
        transactionId: 'TX-PIX-2026',
      });
      expect(trans2.currentState).toBe('Processando');

      // 3. Processando -> start_processing
      await controller.transitionState(orderId, {
        action: 'start_processing',
        operatorId: 'BARBER-MASTER',
      });

      // 4. Processando -> complete -> Concluido
      const trans3 = await controller.transitionState(orderId, {
        action: 'complete',
        completionNotes: 'Atendimento concluído perfeitamente',
      });
      expect(trans3.currentState).toBe('Concluido');
      expect(trans3.order.allowedActions).toEqual([]);
    });

    it('deve lançar BadRequestException para transições inválidas no estado corrente', async () => {
      const created = controller.createStateOrder({
        customerName: 'Teste Inválido',
        serviceName: 'Corte',
        amountInCents: 3000,
      });

      // Tentar completar diretamente quando o estado é Criado
      await expect(
        controller.transitionState(created.order.id, {
          action: 'complete',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Progressive Fine Endpoints (Strategy Pattern)', () => {
    it('deve listar as estratégias de multa progressiva disponíveis', () => {
      const response = controller.getProgressiveFineStrategies();
      expect(response.pattern).toBe('GoF Behavioral - Strategy Pattern');
      expect(response.strategies.length).toBeGreaterThanOrEqual(4);
      expect(response.strategies.map((s) => s.type)).toEqual(
        expect.arrayContaining(['linear', 'tiered', 'compound', 'regulatory']),
      );
    });

    it('deve calcular multa progressiva com estratégia escalonada (tiered)', () => {
      const result = controller.calculateProgressiveFine({
        baseAmount: 1000,
        overdueDays: 20,
        strategyType: 'tiered',
        gracePeriodDays: 0,
        recurrenceCount: 0,
      });

      expect(result.pattern).toBe('GoF Behavioral - Strategy Pattern');
      expect(result.strategyUsed).toBe('TieredProgressiveFineStrategy');
      expect(result.calculation.totalFineAmount).toBeGreaterThan(0);
      expect(result.calculation.finalPayableAmount).toBe(
        1000 + result.calculation.totalFineAmount,
      );
    });
  });

  describe('Domain Event Bus Endpoints (Observer Pattern)', () => {
    it('deve publicar e consultar eventos de domínio no histórico', async () => {
      const pubRes = await controller.publishDomainEvent({
        eventName: 'custom.audit_log',
        payload: { action: 'TEST_TRIGGER', user: 'admin' },
        correlationId: 'trace-unit-test-123',
      });

      expect(pubRes.pattern).toBe('GoF Behavioral - Observer Pattern');
      expect(pubRes.event.eventName).toBe('custom.audit_log');

      const history = controller.getDomainEvents();
      expect(history.totalRegistered).toBeGreaterThan(0);
      expect(history.events.some((e) => e.eventName === 'custom.audit_log')).toBe(true);
    });
  });
});

