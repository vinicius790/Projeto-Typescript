import type { Strategy } from './strategy';
import { StrategyContext } from './strategy';

export interface Order {
  readonly subtotal: number;
  readonly quantity: number;
}

/** Toda estratégia de desconto recebe o pedido e devolve o VALOR do desconto. */
export type DiscountStrategy = Strategy<Order, number>;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertPercent(percent: number): void {
  if (!(percent >= 0 && percent <= 100)) {
    throw new RangeError(`Percentual inválido: ${percent}. Use um valor de 0 a 100.`);
  }
}

export class NoDiscount implements DiscountStrategy {
  execute(): number {
    return 0;
  }
}

export class PercentageDiscount implements DiscountStrategy {
  constructor(private readonly percent: number) {
    assertPercent(percent);
  }

  execute(order: Order): number {
    return roundCents((order.subtotal * this.percent) / 100);
  }
}

/** Desconto de atacado: o percentual só vale a partir de uma quantidade mínima. */
export class BulkDiscount implements DiscountStrategy {
  constructor(
    private readonly minimumQuantity: number,
    private readonly percent: number,
  ) {
    assertPercent(percent);
  }

  execute(order: Order): number {
    if (order.quantity < this.minimumQuantity) {
      return 0;
    }
    return roundCents((order.subtotal * this.percent) / 100);
  }
}

/** Desconto de valor fixo, limitado ao subtotal (o total nunca fica negativo). */
export class FixedDiscount implements DiscountStrategy {
  constructor(private readonly amount: number) {
    if (!(amount >= 0)) {
      throw new RangeError(`Valor de desconto inválido: ${amount}.`);
    }
  }

  execute(order: Order): number {
    return Math.min(this.amount, order.subtotal);
  }
}

/** Contexto concreto: o caixa calcula o total sem saber qual desconto está ativo. */
export class Checkout extends StrategyContext<Order, number> {
  constructor(strategy: DiscountStrategy = new NoDiscount()) {
    super(strategy);
  }

  total(order: Order): number {
    return roundCents(order.subtotal - this.execute(order));
  }
}
