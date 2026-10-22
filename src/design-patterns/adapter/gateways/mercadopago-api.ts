/**
 * API externa simulada do Mercado Pago (Adaptee).
 *
 * Utiliza termos em português e campos específicos do ecossistema latino-americano / PIX.
 */
export interface MercadoPagoPaymentPayload {
  transaction_amount: number; // valor float (ex: 99.90)
  description: string;
  payment_method_id: 'pix' | 'credit_card';
  payer: {
    email: string;
  };
  external_reference: string;
}

export interface MercadoPagoPaymentResponse {
  id: number;
  status: 'approved' | 'rejected' | 'in_process';
  status_detail: string;
  date_approved: string;
  fee_details: Array<{
    amount: number;
    fee_payer: string;
    type: string;
  }>;
}

export interface MercadoPagoRefundResponse {
  id: number;
  payment_id: number;
  amount: number;
  status: 'approved' | 'rejected';
}

export class MercadoPagoExternalApi {
  async createPayment(payload: MercadoPagoPaymentPayload): Promise<MercadoPagoPaymentResponse> {
    if (payload.transaction_amount <= 0) {
      return {
        id: Math.floor(Math.random() * 1_000_000),
        status: 'rejected',
        status_detail: 'cc_rejected_invalid_amount',
        date_approved: new Date().toISOString(),
        fee_details: [],
      };
    }

    const feeAmount = parseFloat((payload.transaction_amount * 0.0099).toFixed(2));

    return {
      id: Math.floor(100_000_000 + Math.random() * 900_000_000),
      status: 'approved',
      status_detail: 'accredited',
      date_approved: new Date().toISOString(),
      fee_details: [
        {
          amount: feeAmount,
          fee_payer: 'collector',
          type: 'mercadopago_fee',
        },
      ],
    };
  }

  async refundPayment(paymentId: number, amount: number): Promise<MercadoPagoRefundResponse> {
    return {
      id: Math.floor(Math.random() * 100_000),
      payment_id: paymentId,
      amount,
      status: 'approved',
    };
  }
}
