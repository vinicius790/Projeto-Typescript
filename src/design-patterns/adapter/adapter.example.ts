import type { Log } from '../log';
import { PaymentRequest } from './adapter';
import { MercadoPagoPaymentAdapter } from './mercadopago-payment.adapter';
import { PayPalPaymentAdapter } from './paypal-payment.adapter';
import { StripePaymentAdapter } from './stripe-payment.adapter';

export function runAdapterExample(log: Log = console.log): void {
  log('--- Adapter ---');

  const request: PaymentRequest = {
    orderId: 'ORD-9872',
    amountInCents: 15000, // R$ 150,00
    currency: 'BRL',
    customerEmail: 'cliente@exemplo.com',
  };

  const adapters = [
    new StripePaymentAdapter(),
    new PayPalPaymentAdapter(),
    new MercadoPagoPaymentAdapter(),
  ];

  // O cliente consome qualquer adapter de forma 100% polimórfica e transparente
  for (const adapter of adapters) {
    // Executa síncrono/resolvido para o runner de exemplo
    adapter.processPayment(request).then((result) => {
      log(
        `[${result.provider}] Transação: ${result.transactionId} | Status: ${result.status} | Taxa: ${result.feeInCents} centavos`,
      );
    });
  }
}
