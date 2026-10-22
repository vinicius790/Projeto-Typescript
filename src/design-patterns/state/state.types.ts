/**
 * Tipos e Contratos do Padrão Comportamental State.
 *
 * Máquina de estados finitos que encapsula a lógica comportamental
 * e as transições do ciclo de vida de uma Ordem ou Serviço.
 */

export type OrderStatusName =
  | 'Criado'
  | 'AguardandoPagamento'
  | 'Processando'
  | 'Concluido'
  | 'Cancelado';

export interface StateTransitionRecord {
  fromState: OrderStatusName;
  toState: OrderStatusName;
  action: string;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OrderData {
  id: string;
  customerName: string;
  serviceName: string;
  amountInCents: number;
  paymentMethod?: string;
  transactionId?: string;
  operatorId?: string;
  completionNotes?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderStateSnapshot {
  id: string;
  customerName: string;
  serviceName: string;
  amountInCents: number;
  currentState: OrderStatusName;
  allowedActions: string[];
  paymentMethod?: string;
  transactionId?: string;
  operatorId?: string;
  completionNotes?: string;
  cancelReason?: string;
  history: StateTransitionRecord[];
  createdAt: Date;
  updatedAt: Date;
}
