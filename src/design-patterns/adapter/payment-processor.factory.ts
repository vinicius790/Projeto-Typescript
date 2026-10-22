import { PaymentProcessor } from './adapter';
import { MercadoPagoPaymentAdapter } from './mercadopago-payment.adapter';
import { PayPalPaymentAdapter } from './paypal-payment.adapter';
import { StripePaymentAdapter } from './stripe-payment.adapter';

export type SupportedPaymentProvider = 'stripe' | 'paypal' | 'mercadopago';

export class PaymentProcessorFactory {
  static create(provider: SupportedPaymentProvider | string): PaymentProcessor {
    switch (provider.toLowerCase()) {
      case 'stripe':
        return new StripePaymentAdapter();
      case 'paypal':
        return new PayPalPaymentAdapter();
      case 'mercadopago':
      case 'mp':
        return new MercadoPagoPaymentAdapter();
      default:
        throw new Error(
          `Provedor de pagamento não suportado: "${provider}". Use: stripe, paypal ou mercadopago.`,
        );
    }
  }

  static getSupportedProviders(): string[] {
    return ['stripe', 'paypal', 'mercadopago'];
  }
}
