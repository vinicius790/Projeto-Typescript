import type { Log } from '../log';
import type { DiscountStrategy, Order } from './discounts';
import { BulkDiscount, Checkout, FixedDiscount, PercentageDiscount } from './discounts';
import { StrategyContext } from './strategy';

export function runStrategyExample(log: Log = console.log): void {
  const order: Order = { subtotal: 200, quantity: 12 };
  const checkout = new Checkout();
  const campaigns: [string, DiscountStrategy][] = [
    ['10% de desconto', new PercentageDiscount(10)],
    ['atacado (15% a partir de 10 itens)', new BulkDiscount(10, 15)],
    ['cupom de R$ 50', new FixedDiscount(50)],
  ];

  log('--- Strategy ---');
  log(`Sem desconto: ${checkout.total(order)}`);
  for (const [name, strategy] of campaigns) {
    // O caixa é o mesmo; só a estratégia é trocada em tempo de execução.
    log(`Com ${name}: ${checkout.use(strategy).total(order)}`);
  }

  // O contexto genérico serve para qualquer família de algoritmos.
  const sorter = new StrategyContext<number[], number[]>({
    execute: (values) => values.toSorted((a, b) => a - b),
  });
  log(`Ordem crescente: ${sorter.execute([3, 1, 2]).join(', ')}`);
  sorter.use({ execute: (values) => values.toSorted((a, b) => b - a) });
  log(`Ordem decrescente: ${sorter.execute([3, 1, 2]).join(', ')}`);
}
