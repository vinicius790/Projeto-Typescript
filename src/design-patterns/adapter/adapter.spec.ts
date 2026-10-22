import { PaymentRequest } from './adapter';
import { MercadoPagoExternalApi } from './gateways/mercadopago-api';
import { PayPalExternalApi } from './gateways/paypal-api';
import { StripeExternalApi } from './gateways/stripe-api';
import { MercadoPagoPaymentAdapter } from './mercadopago-payment.adapter';
import { PaymentProcessorFactory } from './payment-processor.factory';
import { PayPalPaymentAdapter } from './paypal-payment.adapter';
import { StripePaymentAdapter } from './stripe-payment.adapter';

describe('Padrão GoF Adapter - Gateways de Pagamento', () => {
  const sampleRequest: PaymentRequest = {
    orderId: 'PED-101',
    amountInCents: 5000, // R$ 50,00
    currency: 'BRL',
    customerEmail: 'dev@exemplo.com',
  };

  describe('StripePaymentAdapter', () => {
    it('adapta requisição com sucesso e formata centavos e taxas', async () => {
      const adapter = new StripePaymentAdapter();
      const result = await adapter.processPayment(sampleRequest);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('Stripe');
      expect(result.status).toBe('PAID');
      expect(result.transactionId).toMatch(/^ch_/);
      expect(result.amountInCents).toBe(5000);
      expect(result.feeInCents).toBeGreaterThan(0);
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('trata falha de valor inválido retornando status FAILED', async () => {
      const adapter = new StripePaymentAdapter();
      const result = await adapter.processPayment({ ...sampleRequest, amountInCents: -100 });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Invalid amount');
    });

    it('executa estorno através do adapter', async () => {
      const adapter = new StripePaymentAdapter();
      const refund = await adapter.refund('ch_test_123', 2500);

      expect(refund.success).toBe(true);
      expect(refund.refundId).toMatch(/^re_/);
      expect(refund.refundedAmountInCents).toBe(2500);
    });
  });

  describe('PayPalPaymentAdapter', () => {
    it('adapta requisição convertendo centavos para string decimal', async () => {
      const mockApi = new PayPalExternalApi();
      const spy = jest.spyOn(mockApi, 'executeOrder');
      const adapter = new PayPalPaymentAdapter(mockApi);

      const result = await adapter.processPayment(sampleRequest);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          purchase_units: [
            expect.objectContaining({
              amount: {
                currency_code: 'BRL',
                value: '50.00',
              },
            }),
          ],
        }),
      );
      expect(result.success).toBe(true);
      expect(result.provider).toBe('PayPal');
      expect(result.status).toBe('PAID');
      expect(result.transactionId).toMatch(/^CAP-/);
    });

    it('trata rejeição de pagamento pelo PayPal', async () => {
      const adapter = new PayPalPaymentAdapter();
      const result = await adapter.processPayment({ ...sampleRequest, amountInCents: 0 });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('declined');
    });

    it('executa estorno através do adapter PayPal', async () => {
      const adapter = new PayPalPaymentAdapter();
      const refund = await adapter.refund('CAP-ABC123', 5000);

      expect(refund.success).toBe(true);
      expect(refund.refundId).toMatch(/^REFUND-/);
    });
  });

  describe('MercadoPagoPaymentAdapter', () => {
    it('adapta requisição para PIX e valores float', async () => {
      const mockApi = new MercadoPagoExternalApi();
      const spy = jest.spyOn(mockApi, 'createPayment');
      const adapter = new MercadoPagoPaymentAdapter(mockApi);

      const result = await adapter.processPayment(sampleRequest);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_amount: 50,
          payment_method_id: 'pix',
          payer: { email: 'dev@exemplo.com' },
        }),
      );
      expect(result.success).toBe(true);
      expect(result.provider).toBe('MercadoPago');
      expect(result.status).toBe('PAID');
    });

    it('trata falha de valor menor ou igual a zero', async () => {
      const adapter = new MercadoPagoPaymentAdapter();
      const result = await adapter.processPayment({ ...sampleRequest, amountInCents: -50 });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('executa estorno através do adapter Mercado Pago', async () => {
      const adapter = new MercadoPagoPaymentAdapter();
      const refund = await adapter.refund('123456789', 3000);

      expect(refund.success).toBe(true);
      expect(refund.refundedAmountInCents).toBe(3000);
    });
  });

  describe('PaymentProcessorFactory', () => {
    it('cria o adapter correto para cada provedor', () => {
      expect(PaymentProcessorFactory.create('stripe')).toBeInstanceOf(StripePaymentAdapter);
      expect(PaymentProcessorFactory.create('paypal')).toBeInstanceOf(PayPalPaymentAdapter);
      expect(PaymentProcessorFactory.create('mercadopago')).toBeInstanceOf(
        MercadoPagoPaymentAdapter,
      );
    });

    it('lança erro descritivo para provedores desconhecidos', () => {
      expect(() => PaymentProcessorFactory.create('desconhecido')).toThrow(
        /Provedor de pagamento não suportado/,
      );
    });

    it('informa lista de provedores suportados', () => {
      expect(PaymentProcessorFactory.getSupportedProviders()).toEqual([
        'stripe',
        'paypal',
        'mercadopago',
      ]);
    });
  });
});
