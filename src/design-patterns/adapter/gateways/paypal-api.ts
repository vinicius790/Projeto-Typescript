/**
 * API externa simulada do PayPal (Adaptee).
 *
 * Utiliza convenção de purchase_units, valores em formato string decimal (ex: "10.50")
 * e códigos de status como COMPLETED / DECLINED.
 */
export interface PayPalOrderPayload {
  intent: 'CAPTURE';
  purchase_units: [
    {
      reference_id: string;
      amount: {
        currency_code: string;
        value: string; // formato decimal string ex: "15.00"
      };
    },
  ];
  payer: {
    email_address: string;
  };
}

export interface PayPalOrderResponse {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PENDING';
  purchase_units: [
    {
      payments: {
        captures: [
          {
            id: string;
            seller_receivable_breakdown?: {
              paypal_fee: {
                value: string;
              };
            };
            create_time: string;
          },
        ];
      };
    },
  ];
}

export interface PayPalRefundResponse {
  id: string;
  status: 'COMPLETED' | 'FAILED';
  amount: {
    value: string;
  };
}

export class PayPalExternalApi {
  async executeOrder(payload: PayPalOrderPayload): Promise<PayPalOrderResponse> {
    const rawVal = parseFloat(payload.purchase_units[0].amount.value);
    if (isNaN(rawVal) || rawVal <= 0) {
      return {
        id: `PAYID-DECLINED-${Date.now()}`,
        status: 'DECLINED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `CAPTURE-DECLINED`,
                  create_time: new Date().toISOString(),
                },
              ],
            },
          },
        ],
      };
    }

    const fee = (rawVal * 0.034 + 0.4).toFixed(2);
    const captureId = `CAP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    return {
      id: `PAYID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: captureId,
                seller_receivable_breakdown: {
                  paypal_fee: {
                    value: fee,
                  },
                },
                create_time: new Date().toISOString(),
              },
            ],
          },
        },
      ],
    };
  }

  async refundCapture(captureId: string, value: string): Promise<PayPalRefundResponse> {
    return {
      id: `REFUND-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: 'COMPLETED',
      amount: { value },
    };
  }
}
