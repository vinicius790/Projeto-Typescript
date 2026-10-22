import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentProcessorFactory } from './adapter';
import {
  BaseOrderService,
  CachingOrderServiceDecorator,
  LoggingOrderServiceDecorator,
  PerformanceOrderServiceDecorator,
} from './decorator';
import { TransactionPipeline } from './chain-of-responsibility';
import {
  InvalidStateTransitionException,
  OrderContext,
} from './state';
import {
  AuthorizeTransactionDto,
  CalculateFineDto,
  CreateOrderDemoDto,
  CreateStateOrderDto,
  ProcessPaymentDto,
  PublishEventDemoDto,
  TransitionOrderStateDto,
} from './dto';
import { domainEventBus } from './observer';
import { ProgressiveFineContext } from './strategy';

@ApiTags('Design Patterns')
@Controller('patterns')
export class DesignPatternsController {
  private readonly baseOrderService = new BaseOrderService();
  private readonly cachingDecorator = new CachingOrderServiceDecorator(this.baseOrderService);
  private readonly performanceDecorator = new PerformanceOrderServiceDecorator(
    this.cachingDecorator,
  );
  private readonly orderService = new LoggingOrderServiceDecorator(this.performanceDecorator);

  // Armazenamento em memória para demonstração interativa do State Pattern
  private readonly stateOrders = new Map<string, OrderContext>();

  constructor() {
    // Inicializa uma ordem demonstrativa no estado inicial
    const demoOrder = new OrderContext({
      id: 'ORD-DEMO-001',
      customerName: 'Cliente Demonstração',
      serviceName: 'Cabelo + Barba Clássica',
      amountInCents: 8000,
    });
    this.stateOrders.set(demoOrder.data.id, demoOrder);
  }

  @Get('catalog')
  @ApiOperation({
    summary: 'Catálogo de Padrões GoF Implementados',
    description: 'Lista todos os padrões de projeto com detalhes, tipos e finalidade.',
  })
  getCatalog() {
    return {
      total: 9,
      patterns: [
        {
          name: 'Prototype',
          classification: 'Criacional',
          description: 'Clonagem rasa e profunda de objetos com suporte a ciclos e registro central.',
        },
        {
          name: 'Builder',
          classification: 'Criacional',
          description: 'Construção fluente e validada passo a passo de requisições HTTP imutáveis.',
        },
        {
          name: 'Factory Method',
          classification: 'Criacional',
          description: 'Delegação da criação de transportes concretos de notificação (E-mail, SMS).',
        },
        {
          name: 'Abstract Factory',
          classification: 'Criacional',
          description: 'Famílias consistentes de componentes de interface gráfica (Botões, Checkboxes).',
        },
        {
          name: 'Observer',
          classification: 'Comportamental',
          description: 'Pub/Sub desacoplado para notificações de alterações de estado em tempo real.',
        },
        {
          name: 'Strategy',
          classification: 'Comportamental',
          description: 'Família de algoritmos intercambiáveis de cálculo de descontos em tempo de execução.',
        },
        {
          name: 'Adapter',
          classification: 'Estrutural',
          description:
            'Unificação de múltiplos gateways de pagamento (Stripe, PayPal, Mercado Pago) sob interface comum.',
        },
        {
          name: 'Decorator',
          classification: 'Estrutural',
          description:
            'Agregação dinâmica de logging, telemetria de performance e cache em camadas transparentes.',
        },
        {
          name: 'Chain of Responsibility',
          classification: 'Comportamental',
          description:
            'Pipeline sequencial desacoplado de validação e autorização transacional e agendamentos com short-circuit.',
        },
        {
          name: 'State',
          classification: 'Comportamental',
          description:
            'Máquina de estados comportamental completa para o ciclo de vida de uma Ordem/Serviço com transições controladas.',
        },
      ],
    };
  }

  /* -------------------------------------------------------------------------- */
  /* ADAPTER PATTERN ENDPOINTS                                                  */
  /* -------------------------------------------------------------------------- */

  @Post('adapter/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Processa pagamento usando o Padrão Adapter',
    description:
      'Converte a requisição unificada para o contrato proprietário do gateway escolhido (Stripe, PayPal ou Mercado Pago).',
  })
  @ApiResponse({ status: 200, description: 'Pagamento processado com sucesso pelo adapter.' })
  async processPayment(@Body() dto: ProcessPaymentDto) {
    const processor = PaymentProcessorFactory.create(dto.provider);
    const result = await processor.processPayment({
      orderId: dto.orderId,
      amountInCents: dto.amountInCents,
      currency: dto.currency,
      customerEmail: dto.customerEmail,
    });

    return {
      message: `Pagamento processado com sucesso via Adapter [${processor.provider}]`,
      pattern: 'GoF Structural - Adapter',
      adapterUsed: processor.constructor.name,
      result,
    };
  }

  @Get('adapter/providers')
  @ApiOperation({
    summary: 'Lista provedores suportados pelo Padrão Adapter',
    description: 'Devolve a lista de gateways adaptados disponíveis.',
  })
  getAdapterProviders() {
    return {
      pattern: 'GoF Structural - Adapter',
      supportedProviders: PaymentProcessorFactory.getSupportedProviders(),
      adapters: [
        { provider: 'stripe', adapterClass: 'StripePaymentAdapter', nativeUnit: 'cents' },
        { provider: 'paypal', adapterClass: 'PayPalPaymentAdapter', nativeUnit: 'decimal string' },
        { provider: 'mercadopago', adapterClass: 'MercadoPagoPaymentAdapter', nativeUnit: 'float BRL' },
      ],
    };
  }

  /* -------------------------------------------------------------------------- */
  /* DECORATOR PATTERN ENDPOINTS                                                */
  /* -------------------------------------------------------------------------- */

  @Post('decorator/order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria pedido decorado com Logging, Performance e Cache',
    description:
      'Demonstra o padrão Decorator interceptando e enriquecendo a execução do serviço base.',
  })
  async createOrder(@Body() dto: CreateOrderDemoDto) {
    const order = await this.orderService.createOrder(dto);
    const logs = this.orderService.getCapturedLogs();
    const metrics = this.performanceDecorator.getMetrics();
    const cacheStats = this.cachingDecorator.getStats();

    return {
      pattern: 'GoF Structural - Decorator',
      decoratorStack: [
        'LoggingOrderServiceDecorator',
        'PerformanceOrderServiceDecorator',
        'CachingOrderServiceDecorator',
        'BaseOrderService',
      ],
      order,
      telemetry: {
        cache: cacheStats,
        metrics,
        recentLogs: logs.slice(-5),
      },
    };
  }

  @Get('decorator/orders')
  @ApiOperation({
    summary: 'Lista pedidos com medição de performance decorada',
  })
  async listOrders() {
    const orders = await this.orderService.listOrders();
    return {
      total: orders.length,
      orders,
      performance: this.performanceDecorator.getMetrics(),
      cache: this.cachingDecorator.getStats(),
    };
  }

  @Get('decorator/order/:id')
  @ApiOperation({
    summary: 'Busca pedido demonstrando Cache e Telemetria decoradas',
  })
  async getOrder(@Param('id') id: string) {
    const order = await this.orderService.getOrderById(id);
    return {
      order,
      cacheStats: this.cachingDecorator.getStats(),
      metrics: this.performanceDecorator.getMetrics(),
    };
  }

  @Get('decorator/metrics')
  @ApiOperation({
    summary: 'Retorna métricas de performance coletadas pelo Decorator',
  })
  getPerformanceMetrics() {
    return {
      pattern: 'GoF Structural - Decorator',
      metrics: this.performanceDecorator.getMetrics(),
      cache: this.cachingDecorator.getStats(),
    };
  }

  /* -------------------------------------------------------------------------- */
  /* CHAIN OF RESPONSIBILITY PATTERN ENDPOINTS                                   */
  /* -------------------------------------------------------------------------- */

  @Post('chain/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Processa autorização financeira/agendamento via Chain of Responsibility',
    description:
      'Executa a esteira sequencial de validações: Checagem de Saldo -> Antifraude -> Limite Diário -> Aprovação Final.',
  })
  @ApiResponse({ status: 200, description: 'Resultado da autorização retornado pela esteira.' })
  async authorizeTransaction(@Body() dto: AuthorizeTransactionDto) {
    const isScheduling = dto.pipelineType === 'scheduling';
    const chain = isScheduling
      ? TransactionPipeline.createSchedulingAuthorizationChain()
      : TransactionPipeline.createFinancialAuthorizationChain();

    const transactionId =
      dto.transactionId || `TX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const result = await chain.handle({
      transactionId,
      accountId: dto.accountId,
      amountInCents: dto.amountInCents,
      currency: dto.currency || 'BRL',
      accountBalanceInCents: dto.accountBalanceInCents,
      dailyLimitInCents: dto.dailyLimitInCents,
      dailySpentInCents: dto.dailySpentInCents,
      customerRiskScore: dto.customerRiskScore,
    });

    return {
      message: `Autorização processada via Chain of Responsibility [${isScheduling ? 'Agendamento' : 'Financeira'}]`,
      pattern: 'GoF Behavioral - Chain of Responsibility',
      pipelineType: isScheduling ? 'scheduling' : 'financial',
      result,
    };
  }

  @Get('chain/pipeline')
  @ApiOperation({
    summary: 'Estrutura e elos da Chain of Responsibility',
    description: 'Lista a ordem e a finalidade de cada handler na esteira de autorização.',
  })
  getChainPipeline() {
    return {
      pattern: 'GoF Behavioral - Chain of Responsibility',
      financialPipeline: [
        { step: 1, handler: 'BalanceCheckHandler', description: 'Valida provisão de fundos do cliente' },
        { step: 2, handler: 'FraudCheckHandler', description: 'Audita score de risco e indicadores de fraude' },
        { step: 3, handler: 'DailyLimitCheckHandler', description: 'Fiscaliza o limite diário acumulado' },
        { step: 4, handler: 'FinalApprovalHandler', description: 'Gera token de liquidação e aprova a transação' },
      ],
      schedulingPipeline: [
        { step: 1, handler: 'BalanceCheckHandler', description: 'Valida disponibilidade de crédito ou provisão' },
        { step: 2, handler: 'FraudCheckHandler', description: 'Verifica segurança e autenticidade da conta' },
        { step: 3, handler: 'FinalApprovalHandler', description: 'Confirma formalmente a reserva do agendamento' },
      ],
    };
  }

  /* -------------------------------------------------------------------------- */
  /* STATE PATTERN ENDPOINTS                                                    */
  /* -------------------------------------------------------------------------- */

  @Post('state/orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria uma nova ordem gerenciada pelo State Pattern',
    description: 'Instancia uma ordem de serviço que inicia no estado [Criado].',
  })
  @ApiResponse({ status: 201, description: 'Ordem criada com sucesso no estado Criado.' })
  createStateOrder(@Body() dto: CreateStateOrderDto) {
    const order = new OrderContext({
      customerName: dto.customerName,
      serviceName: dto.serviceName,
      amountInCents: dto.amountInCents,
    });

    this.stateOrders.set(order.data.id, order);

    return {
      message: 'Ordem de serviço criada no estado [Criado]',
      pattern: 'GoF Behavioral - State Pattern',
      order: order.toJSON(),
    };
  }

  @Get('state/orders')
  @ApiOperation({
    summary: 'Lista ordens gerenciadas pelo State Pattern',
    description: 'Retorna todas as ordens e seus estados comportamentais correntes.',
  })
  listStateOrders() {
    const orders = Array.from(this.stateOrders.values()).map((o) => o.toJSON());
    return {
      pattern: 'GoF Behavioral - State Pattern',
      total: orders.length,
      orders,
    };
  }

  @Get('state/orders/:id')
  @ApiOperation({
    summary: 'Obtém detalhes e histórico completo de transições de uma ordem',
    description: 'Exibe o estado corrente, ações autorizadas e a trilha de auditoria.',
  })
  getStateOrder(@Param('id') id: string) {
    const order = this.stateOrders.get(id);
    if (!order) {
      throw new NotFoundException(`Ordem com ID '${id}' não encontrada.`);
    }

    return {
      pattern: 'GoF Behavioral - State Pattern',
      order: order.toJSON(),
    };
  }

  @Post('state/orders/:id/transition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Executa transição de estado comportamental na ordem',
    description:
      'Dispara uma ação de negócio (submit_payment, confirm_payment, start_processing, complete, cancel). Ações inválidas para o estado corrente serão rejeitadas.',
  })
  @ApiResponse({ status: 200, description: 'Transição efetuada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Transição inválida para o estado atual.' })
  async transitionState(
    @Param('id') id: string,
    @Body() dto: TransitionOrderStateDto,
  ) {
    const order = this.stateOrders.get(id);
    if (!order) {
      throw new NotFoundException(`Ordem com ID '${id}' não encontrada.`);
    }

    const previousState = order.getStateName();

    try {
      switch (dto.action) {
        case 'submit_payment':
          await order.submitForPayment(dto.paymentMethod);
          break;
        case 'confirm_payment':
          await order.confirmPayment(dto.transactionId || `TX-${Date.now().toString(36)}`);
          break;
        case 'start_processing':
          await order.startProcessing(dto.operatorId);
          break;
        case 'complete':
          await order.complete(dto.completionNotes);
          break;
        case 'cancel':
          await order.cancel(dto.reason || 'Cancelamento solicitado pelo usuário');
          break;
        default:
          throw new BadRequestException(`Ação desconhecida '${dto.action}'.`);
      }
    } catch (err: unknown) {
      if (err instanceof InvalidStateTransitionException) {
        throw new BadRequestException({
          error: 'Transição de Estado Não Permitida',
          currentState: err.currentState,
          attemptedAction: err.attemptedAction,
          allowedActions: err.allowedActions,
          message: err.message,
        });
      }
      const message = err instanceof Error ? err.message : 'Erro ao processar transição de estado';
      throw new BadRequestException(message);
    }

    return {
      message: `Ação '${dto.action}' executada: [${previousState}] -> [${order.getStateName()}]`,
      pattern: 'GoF Behavioral - State Pattern',
      previousState,
      currentState: order.getStateName(),
      order: order.toJSON(),
    };
  }

  /* -------------------------------------------------------------------------- */
  /* STRATEGY PATTERN — PROGRESSIVE FINES ENDPOINTS                             */
  /* -------------------------------------------------------------------------- */

  @Post('strategy/fines/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcula multas progressivas com Strategy Pattern',
    description:
      'Aplica dinamicamente uma estratégia de cálculo de penalidade/mora progressiva (Linear, Escalonada/Tiered, Composta ou Regulatória CDC).',
  })
  @ApiResponse({ status: 200, description: 'Multa calculada com sucesso segundo a estratégia selecionada.' })
  calculateProgressiveFine(@Body() dto: CalculateFineDto) {
    const context = ProgressiveFineContext.fromType(dto.strategyType);
    const result = context.calculate({
      baseAmount: dto.baseAmount,
      overdueDays: dto.overdueDays,
      gracePeriodDays: dto.gracePeriodDays,
      recurrenceCount: dto.recurrenceCount,
    });

    // Publica evento no DomainEventBus para auditoria e métricas
    domainEventBus.publishSync('fine.calculated', {
      strategy: result.strategyName,
      originalAmount: result.originalAmount,
      totalFine: result.totalFineAmount,
      overdueDays: result.overdueDays,
    });

    return {
      pattern: 'GoF Behavioral - Strategy Pattern',
      strategyUsed: result.strategyName,
      calculation: result,
    };
  }

  @Get('strategy/fines/strategies')
  @ApiOperation({
    summary: 'Lista as estratégias de multa progressiva disponíveis',
    description: 'Devolve as estratégias implementadas e suas regras de negócio.',
  })
  getProgressiveFineStrategies() {
    return {
      pattern: 'GoF Behavioral - Strategy Pattern',
      strategies: [
        {
          type: 'linear',
          name: 'LinearOverdueFineStrategy',
          description: 'Multa base fixa (2%) + percentual diário linear (0.1%/dia) com teto legal.',
        },
        {
          type: 'tiered',
          name: 'TieredProgressiveFineStrategy',
          description:
            'Faixas escalonadas progressivas por dias de atraso (1-15d: 0.1%/dia, 16-30d: 0.25%/dia, 31-60d: 0.4%/dia, >60d: 0.6%/dia) com agravamento por reincidência.',
        },
        {
          type: 'compound',
          name: 'CompoundProgressiveFineStrategy',
          description: 'Mora com juros compostos exponenciais dia a dia + multa base.',
        },
        {
          type: 'regulatory',
          name: 'RegulatoryContractFineStrategy',
          description: 'Em conformidade com CDC (multa máxima de 2%) e juros legais pro rata die (1% a.m.).',
        },
      ],
    };
  }

  /* -------------------------------------------------------------------------- */
  /* OBSERVER PATTERN — TYPED DOMAIN EVENT BUS ENDPOINTS                        */
  /* -------------------------------------------------------------------------- */

  @Get('observer/events')
  @ApiOperation({
    summary: 'Consulta o histórico recente do barramento de eventos de domínio',
    description: 'Retorna eventos publicados no TypedDomainEventBus com timestamps e payloads.',
  })
  getDomainEvents() {
    return {
      pattern: 'GoF Behavioral - Observer Pattern',
      totalRegistered: domainEventBus.getHistory().length,
      activeEventTypes: domainEventBus.activeEventTypesCount,
      events: domainEventBus.getHistory(),
    };
  }

  @Post('observer/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publica um evento demonstrativo no barramento de eventos de domínio',
    description: 'Permite disparar eventos arbitrários e notificar todos os observers registrados.',
  })
  async publishDomainEvent(@Body() dto: PublishEventDemoDto) {
    const published = await domainEventBus.publish(
      dto.eventName as any,
      dto.payload as any,
      { correlationId: dto.correlationId },
    );

    return {
      message: `Evento '${dto.eventName}' publicado com sucesso no EventBus.`,
      pattern: 'GoF Behavioral - Observer Pattern',
      event: published,
    };
  }
}
