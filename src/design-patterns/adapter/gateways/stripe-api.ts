/**
 * API externa simulada do Stripe (Adaptee).
 *
 * Possui sua própria convenção de nomenclatura e estruturas de dados específicas.
 */
export interface StripeChargePayload {
  amount: number; // valor em centavos
  currency: string;
  receipt_email: string;
  metadata: {
    order_id: string;
  };
}

export interface StripeChargeResponse {
  id: string;
  status: 'succeeded' | 'pending' | 'failed';
  fee: number;
  created: number; // epoch em segundos
  failure_message?: string;
}

export interface StripeRefundResponse {
  id: string;
  charge: string;
  amount: number;
  status: 'succeeded' | 'failed';
}

export class StripeExternalApi {
  async createCharge(payload: StripeChargePayload): Promise<StripeChargeResponse> {
    if (payload.amount <= 0) {
      return {
        id: `ch_fail_${Date.now()}`,
        status: 'failed',
        fee: 0,
        created: Math.floor(Date.now() / 1000),
        failure_message: 'Invalid amount',
      };
    }

    // Calcula taxa simulada de 2.9% + 30 centavos
    const fee = Math.round(payload.amount * 0.029 + 30);
    return {
      id: `ch_${Math.random().toString(36).substring(2, 11)}`,
      status: 'succeeded',
      fee,
      created: Math.floor(Date.now() / 1000),
    };
  }

  async refundCharge(chargeId: string, amount: number): Promise<StripeRefundResponse> {
    return {
      id: `re_${Math.random().toString(36).substring(2, 11)}`,
      charge: chargeId,
      amount,
      status: 'succeeded',
    };
  }
}
