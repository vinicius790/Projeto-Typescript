import { BulkDiscount, Checkout, FixedDiscount, NoDiscount, PercentageDiscount } from './discounts';
import type { Strategy } from './strategy';
import { StrategyContext } from './strategy';

const order = { subtotal: 200, quantity: 12 };

describe('StrategyContext', () => {
  const double: Strategy<number, number> = { execute: (value) => value * 2 };
  const square: Strategy<number, number> = { execute: (value) => value * value };

  it('delega a execução à estratégia recebida', () => {
    expect(new StrategyContext(double).execute(5)).toBe(10);
  });

  it('troca a estratégia em tempo de execução', () => {
    const context = new StrategyContext(double);

    expect(context.use(square)).toBe(context);
    expect(context.execute(5)).toBe(25);
  });
});

describe('estratégias de desconto', () => {
  it('NoDiscount não desconta nada', () => {
    expect(new NoDiscount().execute()).toBe(0);
  });

  it('PercentageDiscount calcula o percentual, arredondado em centavos', () => {
    expect(new PercentageDiscount(10).execute(order)).toBe(20);
    expect(new PercentageDiscount(33).execute({ subtotal: 9.99, quantity: 1 })).toBe(3.3);
    expect(new PercentageDiscount(0).execute(order)).toBe(0);
    expect(new PercentageDiscount(100).execute(order)).toBe(200);
  });

  it('BulkDiscount só vale a partir da quantidade mínima', () => {
    const strategy = new BulkDiscount(10, 15);

    expect(strategy.execute({ subtotal: 200, quantity: 9 })).toBe(0);
    expect(strategy.execute({ subtotal: 200, quantity: 10 })).toBe(30);
  });

  it('FixedDiscount é limitado ao subtotal', () => {
    expect(new FixedDiscount(50).execute(order)).toBe(50);
    expect(new FixedDiscount(500).execute(order)).toBe(200);
  });

  it.each([-1, 101, Number.NaN])('recusa o percentual inválido %s', (percent) => {
    expect(() => new PercentageDiscount(percent)).toThrow(RangeError);
    expect(() => new BulkDiscount(1, percent)).toThrow(RangeError);
  });

  it('recusa valor fixo negativo', () => {
    expect(() => new FixedDiscount(-1)).toThrow(RangeError);
  });
});

describe('Checkout', () => {
  it('começa sem desconto', () => {
    expect(new Checkout().total(order)).toBe(200);
  });

  it('calcula o total conforme a estratégia ativa', () => {
    const checkout = new Checkout(new PercentageDiscount(10));

    expect(checkout.total(order)).toBe(180);
    expect(checkout.use(new BulkDiscount(10, 15)).total(order)).toBe(170);
    expect(checkout.use(new FixedDiscount(500)).total(order)).toBe(0);
    expect(checkout.use(new NoDiscount()).total(order)).toBe(200);
  });
});
