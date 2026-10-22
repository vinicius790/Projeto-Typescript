/**
 * Contrato de Domínio do Padrão Adapter (Target Interface).
 *
 * O padrão Adapter converte a interface de uma classe na interface esperada pelos
 * clientes. Permite que classes com interfaces incompatíveis trabalhem juntas.
 */

export interface PaymentRequest {
  orderId: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
}

export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED';

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  provider: string;
  status: PaymentStatus;
  amountInCents: number;
  feeInCents: number;
  processedAt: Date;
  rawDetails: Record<string, unknown>;
  errorMessage?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  transactionId: string;
  refundId: string;
  refundedAmountInCents: number;
  processedAt: Date;
}

/**
 * Interface Alvo (Target) que o sistema consome uniformemente,
 * independentemente de qual gateway terceirizado está sendo utilizado.
 */
export interface PaymentProcessor {
  readonly provider: string;
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  refund(transactionId: string, amountInCents: number): Promise<PaymentRefundResult>;
}
