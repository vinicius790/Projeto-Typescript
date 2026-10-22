import {
  PaymentProcessor,
  PaymentRefundResult,
  PaymentRequest,
  PaymentResult,
} from './adapter';
import { StripeExternalApi } from './gateways/stripe-api';

/**
 * Adapter para o gateway Stripe.
 *
 * Mapeia PaymentRequest padrão para o payload esperado pela StripeExternalApi,
 * convertendo tipos, tratando taxas e normalizando respostas de erro ou sucesso.
 */
export class StripePaymentAdapter implements PaymentProcessor {
  readonly provider = 'Stripe';

  constructor(private readonly stripeApi: StripeExternalApi = new StripeExternalApi()) {}

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const response = await this.stripeApi.createCharge({
      amount: request.amountInCents,
      currency: request.currency.toLowerCase(),
      receipt_email: request.customerEmail,
      metadata: {
        order_id: request.orderId,
      },
    });

    const isSuccess = response.status === 'succeeded';

    return {
      success: isSuccess,
      transactionId: response.id,
      provider: this.provider,
      status: isSuccess ? 'PAID' : 'FAILED',
      amountInCents: request.amountInCents,
      feeInCents: response.fee,
      processedAt: new Date(response.created * 1000),
      errorMessage: response.failure_message,
      rawDetails: { ...response },
    };
  }

  async refund(transactionId: string, amountInCents: number): Promise<PaymentRefundResult> {
    const refund = await this.stripeApi.refundCharge(transactionId, amountInCents);
    return {
      success: refund.status === 'succeeded',
      transactionId,
      refundId: refund.id,
      refundedAmountInCents: refund.amount,
      processedAt: new Date(),
    };
  }
}
