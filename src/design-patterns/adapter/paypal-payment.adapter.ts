import {
  PaymentProcessor,
  PaymentRefundResult,
  PaymentRequest,
  PaymentResult,
} from './adapter';
import { PayPalExternalApi } from './gateways/paypal-api';

/**
 * Adapter para o gateway PayPal.
 *
 * Mapeia centavos inteiros para formato decimal em string (ex: "50.00"),
 * estrutura a árvore de `purchase_units` e normaliza os status.
 */
export class PayPalPaymentAdapter implements PaymentProcessor {
  readonly provider = 'PayPal';

  constructor(private readonly payPalApi: PayPalExternalApi = new PayPalExternalApi()) {}

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const decimalValue = (request.amountInCents / 100).toFixed(2);

    const response = await this.payPalApi.executeOrder({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: request.orderId,
          amount: {
            currency_code: request.currency.toUpperCase(),
            value: decimalValue,
          },
        },
      ],
      payer: {
        email_address: request.customerEmail,
      },
    });

    const isSuccess = response.status === 'COMPLETED';
    const capture = response.purchase_units[0]?.payments?.captures?.[0];
    const rawFee = capture?.seller_receivable_breakdown?.paypal_fee?.value || '0.00';
    const feeInCents = Math.round(parseFloat(rawFee) * 100);

    return {
      success: isSuccess,
      transactionId: capture?.id || response.id,
      provider: this.provider,
      status: isSuccess ? 'PAID' : 'FAILED',
      amountInCents: request.amountInCents,
      feeInCents,
      processedAt: new Date(capture?.create_time || Date.now()),
      errorMessage: isSuccess ? undefined : 'Payment declined by PayPal',
      rawDetails: { ...response },
    };
  }

  async refund(transactionId: string, amountInCents: number): Promise<PaymentRefundResult> {
    const decimalValue = (amountInCents / 100).toFixed(2);
    const refund = await this.payPalApi.refundCapture(transactionId, decimalValue);

    return {
      success: refund.status === 'COMPLETED',
      transactionId,
      refundId: refund.id,
      refundedAmountInCents: amountInCents,
      processedAt: new Date(),
    };
  }
}
