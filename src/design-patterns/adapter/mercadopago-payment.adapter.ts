import {
  PaymentProcessor,
  PaymentRefundResult,
  PaymentRequest,
  PaymentResult,
} from './adapter';
import { MercadoPagoExternalApi } from './gateways/mercadopago-api';

/**
 * Adapter para o gateway Mercado Pago (PIX / Cartão).
 *
 * Mapeia contratos e campos do ecossistema Mercado Pago para o padrão PaymentProcessor.
 */
export class MercadoPagoPaymentAdapter implements PaymentProcessor {
  readonly provider = 'MercadoPago';

  constructor(private readonly mpApi: MercadoPagoExternalApi = new MercadoPagoExternalApi()) {}

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const floatAmount = request.amountInCents / 100;

    const response = await this.mpApi.createPayment({
      transaction_amount: floatAmount,
      description: `Pedido ${request.orderId}`,
      payment_method_id: 'pix',
      payer: {
        email: request.customerEmail,
      },
      external_reference: request.orderId,
    });

    const isSuccess = response.status === 'approved';
    const totalFee = response.fee_details.reduce((sum, item) => sum + item.amount, 0);

    return {
      success: isSuccess,
      transactionId: String(response.id),
      provider: this.provider,
      status: isSuccess ? 'PAID' : response.status === 'in_process' ? 'PENDING' : 'FAILED',
      amountInCents: request.amountInCents,
      feeInCents: Math.round(totalFee * 100),
      processedAt: new Date(response.date_approved),
      errorMessage: isSuccess ? undefined : `MercadoPago status: ${response.status_detail}`,
      rawDetails: { ...response },
    };
  }

  async refund(transactionId: string, amountInCents: number): Promise<PaymentRefundResult> {
    const floatAmount = amountInCents / 100;
    const numericId = parseInt(transactionId, 10);
    const refund = await this.mpApi.refundPayment(numericId, floatAmount);

    return {
      success: refund.status === 'approved',
      transactionId,
      refundId: String(refund.id),
      refundedAmountInCents: amountInCents,
      processedAt: new Date(),
    };
  }
}
