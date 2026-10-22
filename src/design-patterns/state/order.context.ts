import { randomUUID } from 'node:crypto';
import { CreatedState } from './created.state';
import { OrderState } from './order-state.interface';
import {
  OrderData,
  OrderStateSnapshot,
  OrderStatusName,
  StateTransitionRecord,
} from './state.types';

export interface CreateOrderContextParams {
  id?: string;
  customerName: string;
  serviceName: string;
  amountInCents: number;
  initialState?: OrderState;
}

/**
 * Contexto do Padrão State.
 * Mantém a referência para a instância do estado corrente e delega para ela
 * a execução das operações comportamentais do ciclo de vida da Ordem.
 */
export class OrderContext {
  public readonly data: OrderData;
  private currentState: OrderState;
  private readonly history: StateTransitionRecord[] = [];

  constructor(params: CreateOrderContextParams) {
    const now = new Date();
    this.data = {
      id: params.id || `ORD-${randomUUID().substring(0, 8).toUpperCase()}`,
      customerName: params.customerName,
      serviceName: params.serviceName,
      amountInCents: params.amountInCents,
      createdAt: now,
      updatedAt: now,
    };

    this.currentState = params.initialState || new CreatedState();

    // Registra a entrada no estado inicial
    this.history.push({
      fromState: 'Criado',
      toState: this.currentState.name,
      action: 'init',
      reason: 'Ordem inicializada',
      timestamp: now,
    });
  }

  public getStateName(): OrderStatusName {
    return this.currentState.name;
  }

  public getAllowedActions(): string[] {
    return this.currentState.getAllowedActions();
  }

  public getHistory(): StateTransitionRecord[] {
    return [...this.history];
  }

  /**
   * Altera o estado interno e armazena na trilha de auditoria/histórico.
   */
  public transitionTo(
    nextState: OrderState,
    action: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const fromState = this.currentState.name;
    const toState = nextState.name;
    const now = new Date();

    this.history.push({
      fromState,
      toState,
      action,
      reason,
      timestamp: now,
      metadata,
    });

    this.currentState = nextState;
    this.data.updatedAt = now;
  }

  public async submitForPayment(paymentMethod?: string): Promise<void> {
    await this.currentState.submitForPayment(this, paymentMethod);
  }

  public async confirmPayment(transactionId: string): Promise<void> {
    await this.currentState.confirmPayment(this, transactionId);
  }

  public async startProcessing(operatorId?: string): Promise<void> {
    await this.currentState.startProcessing(this, operatorId);
  }

  public async complete(notes?: string): Promise<void> {
    await this.currentState.complete(this, notes);
  }

  public async cancel(reason: string): Promise<void> {
    await this.currentState.cancel(this, reason);
  }

  public toJSON(): OrderStateSnapshot {
    return {
      id: this.data.id,
      customerName: this.data.customerName,
      serviceName: this.data.serviceName,
      amountInCents: this.data.amountInCents,
      currentState: this.currentState.name,
      allowedActions: this.getAllowedActions(),
      paymentMethod: this.data.paymentMethod,
      transactionId: this.data.transactionId,
      operatorId: this.data.operatorId,
      completionNotes: this.data.completionNotes,
      cancelReason: this.data.cancelReason,
      history: this.getHistory(),
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
    };
  }
}
