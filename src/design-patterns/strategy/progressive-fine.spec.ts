import {
  CompoundProgressiveFineStrategy,
  LinearOverdueFineStrategy,
  ProgressiveFineContext,
  RegulatoryContractFineStrategy,
  TieredProgressiveFineStrategy,
} from './progressive-fine';

describe('Progressive Fine Strategy Pattern', () => {
  describe('LinearOverdueFineStrategy', () => {
    it('deve retornar zero quando não há dias de atraso', () => {
      const strategy = new LinearOverdueFineStrategy();
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 0 });

      expect(res.totalFineAmount).toBe(0);
      expect(res.finalPayableAmount).toBe(1000);
      expect(res.effectiveOverdueDays).toBe(0);
      expect(res.cappedByLegalLimit).toBe(false);
    });

    it('deve respeitar período de carência (grace period)', () => {
      const strategy = new LinearOverdueFineStrategy();
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 3, gracePeriodDays: 5 });

      expect(res.totalFineAmount).toBe(0);
      expect(res.finalPayableAmount).toBe(1000);
      expect(res.effectiveOverdueDays).toBe(0);
    });

    it('deve calcular multa base + taxa diária linear', () => {
      // 1000 base, 10 dias. Multa base 2% = 20, diária 0.1%/dia * 10 = 10. Total = 30
      const strategy = new LinearOverdueFineStrategy(2.0, 0.1, 20.0);
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 10 });

      expect(res.baseFineAmount).toBe(20);
      expect(res.dailyRateFineAmount).toBe(10);
      expect(res.totalFineAmount).toBe(30);
      expect(res.finalPayableAmount).toBe(1030);
      expect(res.cappedByLegalLimit).toBe(false);
    });

    it('deve aplicar teto legal (legal cap) quando a multa ultrapassa o limite', () => {
      // 1000 base, 300 dias. Teto 20% = 200
      const strategy = new LinearOverdueFineStrategy(2.0, 0.1, 20.0);
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 300 });

      expect(res.totalFineAmount).toBe(200);
      expect(res.finalPayableAmount).toBe(1200);
      expect(res.cappedByLegalLimit).toBe(true);
    });

    it('deve lançar RangeError para valores negativos ou zero', () => {
      const strategy = new LinearOverdueFineStrategy();
      expect(() => strategy.execute({ baseAmount: -10, overdueDays: 5 })).toThrow(RangeError);
      expect(() => strategy.execute({ baseAmount: 100, overdueDays: -1 })).toThrow(RangeError);
    });
  });

  describe('TieredProgressiveFineStrategy', () => {
    it('deve calcular faixas escalonadas corretamente', () => {
      const strategy = new TieredProgressiveFineStrategy(2.0);
      // 20 dias de atraso:
      // Base: 2% de 1000 = 20
      // Faixa 1 (1 a 15 = 15 dias a 0.1%/dia) = 1000 * 1.5% = 15
      // Faixa 2 (16 a 20 = 5 dias a 0.25%/dia) = 1000 * 1.25% = 12.50
      // Total diário = 27.50, Total multa = 20 + 27.50 = 47.50
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 20 });

      expect(res.baseFineAmount).toBe(20);
      expect(res.dailyRateFineAmount).toBe(27.5);
      expect(res.totalFineAmount).toBe(47.5);
      expect(res.finalPayableAmount).toBe(1047.5);
      expect(res.breakdown).toHaveLength(2);
      expect(res.breakdown[0].daysInTier).toBe(15);
      expect(res.breakdown[1].daysInTier).toBe(5);
    });

    it('deve agravar multa base por reincidência', () => {
      const strategy = new TieredProgressiveFineStrategy(2.0);
      // Reincidência 2 -> basePercent = 2.0 + 2 * 0.5 = 3.0%
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 10, recurrenceCount: 2 });

      expect(res.baseFinePercent).toBe(3.0);
      expect(res.baseFineAmount).toBe(30);
    });
  });

  describe('CompoundProgressiveFineStrategy', () => {
    it('deve calcular juros compostos diários exponencialmente', () => {
      const strategy = new CompoundProgressiveFineStrategy(2.0, 0.2, 50.0);
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 30 });

      // Base 2% = 20
      // (1 + 0.002)^30 - 1 = 1.0618 - 1 = 61.80
      expect(res.baseFineAmount).toBe(20);
      expect(res.dailyRateFineAmount).toBeGreaterThan(60);
      expect(res.totalFineAmount).toBeCloseTo(res.baseFineAmount + res.dailyRateFineAmount, 2);
    });
  });

  describe('RegulatoryContractFineStrategy (CDC / Código Civil)', () => {
    it('deve aplicar teto estrito de 2% de multa moratória e juros pro rata die de 1% a.m.', () => {
      const strategy = new RegulatoryContractFineStrategy();
      const res = strategy.execute({ baseAmount: 1000, overdueDays: 30 });

      // 30 dias = 1 mês completo: multa base 20 (2%) + juros 10 (1% a.m.) = 30
      expect(res.baseFinePercent).toBe(2.0);
      expect(res.baseFineAmount).toBe(20);
      expect(res.dailyRateFineAmount).toBe(10);
      expect(res.totalFineAmount).toBe(30);
      expect(res.finalPayableAmount).toBe(1030);
    });
  });

  describe('ProgressiveFineContext (Dynamic Strategy Switching)', () => {
    it('deve permitir trocar estratégias em tempo de execução', () => {
      const context = ProgressiveFineContext.linear();
      const res1 = context.calculate({ baseAmount: 1000, overdueDays: 20 });
      expect(res1.strategyName).toBe('LinearOverdueFineStrategy');

      context.use(new RegulatoryContractFineStrategy());
      const res2 = context.calculate({ baseAmount: 1000, overdueDays: 20 });
      expect(res2.strategyName).toBe('RegulatoryContractFineStrategy');
    });

    it('deve instanciar a partir do helper fromType', () => {
      const ctxTiered = ProgressiveFineContext.fromType('tiered');
      expect(ctxTiered.calculate({ baseAmount: 1000, overdueDays: 5 }).strategyName).toBe(
        'TieredProgressiveFineStrategy',
      );

      const ctxCompound = ProgressiveFineContext.fromType('compound');
      expect(ctxCompound.calculate({ baseAmount: 1000, overdueDays: 5 }).strategyName).toBe(
        'CompoundProgressiveFineStrategy',
      );
    });
  });
});
