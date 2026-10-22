import type { Strategy } from './strategy';
import { StrategyContext } from './strategy';

export interface ProgressiveFineInput {
  /** Valor base do débito/obrigação em reais (deve ser positivo) */
  readonly baseAmount: number;
  /** Quantidade total de dias de atraso desde o vencimento */
  readonly overdueDays: number;
  /** Dias de carência/tolerância nos quais nenhuma multa incide (padrão: 0) */
  readonly gracePeriodDays?: number;
  /** Quantidade de infrações/reincidências prévias do devedor (padrão: 0) */
  readonly recurrenceCount?: number;
}

export interface FineTierBreakdown {
  readonly tierName: string;
  readonly fromDay: number;
  readonly toDay: number | null;
  readonly daysInTier: number;
  readonly dailyRatePercent: number;
  readonly tierFineAmount: number;
}

export interface ProgressiveFineResult {
  readonly strategyName: string;
  readonly originalAmount: number;
  readonly overdueDays: number;
  readonly effectiveOverdueDays: number;
  readonly baseFinePercent: number;
  readonly baseFineAmount: number;
  readonly dailyRateFineAmount: number;
  readonly totalFineAmount: number;
  readonly finalPayableAmount: number;
  readonly cappedByLegalLimit: boolean;
  readonly legalCapPercent: number;
  readonly breakdown: FineTierBreakdown[];
}

export type ProgressiveFineStrategy = Strategy<ProgressiveFineInput, ProgressiveFineResult>;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertPositiveAmount(amount: number): void {
  if (amount <= 0 || !Number.isFinite(amount)) {
    throw new RangeError(`Valor base deve ser um número positivo. Recebido: ${amount}`);
  }
}

function assertValidOverdueDays(days: number): void {
  if (days < 0 || !Number.isInteger(days)) {
    throw new RangeError(`Dias de atraso devem ser um inteiro não-negativo. Recebido: ${days}`);
  }
}

/**
 * Estratégia Linear:
 * Aplica uma multa base fixa inicial + percentual linear de mora para cada dia de atraso.
 */
export class LinearOverdueFineStrategy implements ProgressiveFineStrategy {
  constructor(
    private readonly baseFinePercent: number = 2.0,
    private readonly dailyRatePercent: number = 0.1,
    private readonly legalCapPercent: number = 20.0,
  ) {}

  execute(input: ProgressiveFineInput): ProgressiveFineResult {
    assertPositiveAmount(input.baseAmount);
    assertValidOverdueDays(input.overdueDays);

    const grace = input.gracePeriodDays ?? 0;
    const effectiveDays = Math.max(0, input.overdueDays - grace);

    if (effectiveDays === 0) {
      return {
        strategyName: 'LinearOverdueFineStrategy',
        originalAmount: input.baseAmount,
        overdueDays: input.overdueDays,
        effectiveOverdueDays: 0,
        baseFinePercent: 0,
        baseFineAmount: 0,
        dailyRateFineAmount: 0,
        totalFineAmount: 0,
        finalPayableAmount: input.baseAmount,
        cappedByLegalLimit: false,
        legalCapPercent: this.legalCapPercent,
        breakdown: [],
      };
    }

    const baseFineAmount = roundCents((input.baseAmount * this.baseFinePercent) / 100);
    const dailyRateFineAmount = roundCents(
      (input.baseAmount * (this.dailyRatePercent * effectiveDays)) / 100,
    );
    let totalFine = roundCents(baseFineAmount + dailyRateFineAmount);

    const maxLegalFine = roundCents((input.baseAmount * this.legalCapPercent) / 100);
    const capped = totalFine > maxLegalFine;
    if (capped) {
      totalFine = maxLegalFine;
    }

    const breakdown: FineTierBreakdown[] = [
      {
        tierName: 'Multa Linear Única',
        fromDay: 1,
        toDay: effectiveDays,
        daysInTier: effectiveDays,
        dailyRatePercent: this.dailyRatePercent,
        tierFineAmount: dailyRateFineAmount,
      },
    ];

    return {
      strategyName: 'LinearOverdueFineStrategy',
      originalAmount: input.baseAmount,
      overdueDays: input.overdueDays,
      effectiveOverdueDays: effectiveDays,
      baseFinePercent: this.baseFinePercent,
      baseFineAmount,
      dailyRateFineAmount,
      totalFineAmount: totalFine,
      finalPayableAmount: roundCents(input.baseAmount + totalFine),
      cappedByLegalLimit: capped,
      legalCapPercent: this.legalCapPercent,
      breakdown,
    };
  }
}

export interface TierConfig {
  readonly name: string;
  readonly fromDay: number;
  readonly toDay: number | null; // null significa infinito (faixa aberta)
  readonly dailyRatePercent: number;
}

/**
 * Estratégia Escalonada por Faixas (Tiered Progressive):
 * Conforme o atraso persiste, os juros/multas diárias aumentam de patamar progressivamente.
 */
export class TieredProgressiveFineStrategy implements ProgressiveFineStrategy {
  private readonly tiers: TierConfig[];

  constructor(
    private readonly baseFinePercent: number = 2.0,
    customTiers?: TierConfig[],
    private readonly legalCapPercent: number = 30.0,
  ) {
    this.tiers = customTiers ?? [
      { name: 'Faixa 1 (1 a 15 dias)', fromDay: 1, toDay: 15, dailyRatePercent: 0.1 },
      { name: 'Faixa 2 (16 a 30 dias)', fromDay: 16, toDay: 30, dailyRatePercent: 0.25 },
      { name: 'Faixa 3 (31 a 60 dias)', fromDay: 31, toDay: 60, dailyRatePercent: 0.4 },
      { name: 'Faixa 4 (Mais de 60 dias)', fromDay: 61, toDay: null, dailyRatePercent: 0.6 },
    ];
  }

  execute(input: ProgressiveFineInput): ProgressiveFineResult {
    assertPositiveAmount(input.baseAmount);
    assertValidOverdueDays(input.overdueDays);

    const grace = input.gracePeriodDays ?? 0;
    const effectiveDays = Math.max(0, input.overdueDays - grace);

    if (effectiveDays === 0) {
      return {
        strategyName: 'TieredProgressiveFineStrategy',
        originalAmount: input.baseAmount,
        overdueDays: input.overdueDays,
        effectiveOverdueDays: 0,
        baseFinePercent: 0,
        baseFineAmount: 0,
        dailyRateFineAmount: 0,
        totalFineAmount: 0,
        finalPayableAmount: input.baseAmount,
        cappedByLegalLimit: false,
        legalCapPercent: this.legalCapPercent,
        breakdown: [],
      };
    }

    // Acréscimo por reincidência: +0.5% na multa base por reincidência prévia
    const recurrencePenalty = (input.recurrenceCount ?? 0) * 0.5;
    const effectiveBasePercent = this.baseFinePercent + recurrencePenalty;
    const baseFineAmount = roundCents((input.baseAmount * effectiveBasePercent) / 100);

    const breakdown: FineTierBreakdown[] = [];
    let accumulatedTierFines = 0;

    for (const tier of this.tiers) {
      if (effectiveDays < tier.fromDay) {
        continue;
      }
      const tierEnd = tier.toDay !== null ? Math.min(effectiveDays, tier.toDay) : effectiveDays;
      const daysInTier = tierEnd - tier.fromDay + 1;

      if (daysInTier > 0) {
        const tierAmount = roundCents(
          (input.baseAmount * (tier.dailyRatePercent * daysInTier)) / 100,
        );
        accumulatedTierFines += tierAmount;
        breakdown.push({
          tierName: tier.name,
          fromDay: tier.fromDay,
          toDay: tier.toDay,
          daysInTier,
          dailyRatePercent: tier.dailyRatePercent,
          tierFineAmount: tierAmount,
        });
      }
    }

    let totalFine = roundCents(baseFineAmount + accumulatedTierFines);
    const maxLegalFine = roundCents((input.baseAmount * this.legalCapPercent) / 100);
    const capped = totalFine > maxLegalFine;
    if (capped) {
      totalFine = maxLegalFine;
    }

    return {
      strategyName: 'TieredProgressiveFineStrategy',
      originalAmount: input.baseAmount,
      overdueDays: input.overdueDays,
      effectiveOverdueDays: effectiveDays,
      baseFinePercent: effectiveBasePercent,
      baseFineAmount,
      dailyRateFineAmount: roundCents(accumulatedTierFines),
      totalFineAmount: totalFine,
      finalPayableAmount: roundCents(input.baseAmount + totalFine),
      cappedByLegalLimit: capped,
      legalCapPercent: this.legalCapPercent,
      breakdown,
    };
  }
}

/**
 * Estratégia Composta Exponencial:
 * Calcula mora diária capitalizada juros sobre juros + multa base.
 */
export class CompoundProgressiveFineStrategy implements ProgressiveFineStrategy {
  constructor(
    private readonly baseFinePercent: number = 2.0,
    private readonly dailyCompoundRatePercent: number = 0.15,
    private readonly legalCapPercent: number = 25.0,
  ) {}

  execute(input: ProgressiveFineInput): ProgressiveFineResult {
    assertPositiveAmount(input.baseAmount);
    assertValidOverdueDays(input.overdueDays);

    const grace = input.gracePeriodDays ?? 0;
    const effectiveDays = Math.max(0, input.overdueDays - grace);

    if (effectiveDays === 0) {
      return {
        strategyName: 'CompoundProgressiveFineStrategy',
        originalAmount: input.baseAmount,
        overdueDays: input.overdueDays,
        effectiveOverdueDays: 0,
        baseFinePercent: 0,
        baseFineAmount: 0,
        dailyRateFineAmount: 0,
        totalFineAmount: 0,
        finalPayableAmount: input.baseAmount,
        cappedByLegalLimit: false,
        legalCapPercent: this.legalCapPercent,
        breakdown: [],
      };
    }

    const baseFineAmount = roundCents((input.baseAmount * this.baseFinePercent) / 100);
    const rateDecimal = this.dailyCompoundRatePercent / 100;
    const compoundedFactor = Math.pow(1 + rateDecimal, effectiveDays);
    const dailyRateFineAmount = roundCents(input.baseAmount * (compoundedFactor - 1));

    let totalFine = roundCents(baseFineAmount + dailyRateFineAmount);
    const maxLegalFine = roundCents((input.baseAmount * this.legalCapPercent) / 100);
    const capped = totalFine > maxLegalFine;
    if (capped) {
      totalFine = maxLegalFine;
    }

    const breakdown: FineTierBreakdown[] = [
      {
        tierName: `Composto Diário (${this.dailyCompoundRatePercent}% a.d.)`,
        fromDay: 1,
        toDay: effectiveDays,
        daysInTier: effectiveDays,
        dailyRatePercent: this.dailyCompoundRatePercent,
        tierFineAmount: dailyRateFineAmount,
      },
    ];

    return {
      strategyName: 'CompoundProgressiveFineStrategy',
      originalAmount: input.baseAmount,
      overdueDays: input.overdueDays,
      effectiveOverdueDays: effectiveDays,
      baseFinePercent: this.baseFinePercent,
      baseFineAmount,
      dailyRateFineAmount,
      totalFineAmount: totalFine,
      finalPayableAmount: roundCents(input.baseAmount + totalFine),
      cappedByLegalLimit: capped,
      legalCapPercent: this.legalCapPercent,
      breakdown,
    };
  }
}

/**
 * Estratégia Regulatória / Código de Defesa do Consumidor (CDC Art. 52):
 * Limite estrito de 2% de multa moratória + juros de mora legais de 1% ao mês pro rata die (0.03333%/dia).
 */
export class RegulatoryContractFineStrategy implements ProgressiveFineStrategy {
  private readonly CDC_MAX_FINE_PERCENT = 2.0;
  private readonly MONTHLY_INTEREST_PERCENT = 1.0;
  private readonly DAILY_INTEREST_RATE = this.MONTHLY_INTEREST_PERCENT / 30; // 0.03333% ao dia

  execute(input: ProgressiveFineInput): ProgressiveFineResult {
    assertPositiveAmount(input.baseAmount);
    assertValidOverdueDays(input.overdueDays);

    const grace = input.gracePeriodDays ?? 0;
    const effectiveDays = Math.max(0, input.overdueDays - grace);

    if (effectiveDays === 0) {
      return {
        strategyName: 'RegulatoryContractFineStrategy',
        originalAmount: input.baseAmount,
        overdueDays: input.overdueDays,
        effectiveOverdueDays: 0,
        baseFinePercent: 0,
        baseFineAmount: 0,
        dailyRateFineAmount: 0,
        totalFineAmount: 0,
        finalPayableAmount: input.baseAmount,
        cappedByLegalLimit: false,
        legalCapPercent: this.CDC_MAX_FINE_PERCENT,
        breakdown: [],
      };
    }

    const baseFineAmount = roundCents((input.baseAmount * this.CDC_MAX_FINE_PERCENT) / 100);
    const dailyRateFineAmount = roundCents(
      (input.baseAmount * (this.DAILY_INTEREST_RATE * effectiveDays)) / 100,
    );
    const totalFine = roundCents(baseFineAmount + dailyRateFineAmount);

    const breakdown: FineTierBreakdown[] = [
      {
        tierName: 'Juros de Mora Legais (1% a.m. pro rata die)',
        fromDay: 1,
        toDay: effectiveDays,
        daysInTier: effectiveDays,
        dailyRatePercent: roundCents(this.DAILY_INTEREST_RATE * 100) / 100,
        tierFineAmount: dailyRateFineAmount,
      },
    ];

    return {
      strategyName: 'RegulatoryContractFineStrategy',
      originalAmount: input.baseAmount,
      overdueDays: input.overdueDays,
      effectiveOverdueDays: effectiveDays,
      baseFinePercent: this.CDC_MAX_FINE_PERCENT,
      baseFineAmount,
      dailyRateFineAmount,
      totalFineAmount: totalFine,
      finalPayableAmount: roundCents(input.baseAmount + totalFine),
      cappedByLegalLimit: false,
      legalCapPercent: 100, // não se aplica teto artificial pois segue lei estrita
      breakdown,
    };
  }
}

/**
 * Contexto de Cálculo de Multas:
 * Permite alternar dinamicamente a estratégia de cálculo de multa em tempo de execução.
 */
export class ProgressiveFineContext extends StrategyContext<
  ProgressiveFineInput,
  ProgressiveFineResult
> {
  constructor(strategy: ProgressiveFineStrategy = new LinearOverdueFineStrategy()) {
    super(strategy);
  }

  calculate(input: ProgressiveFineInput): ProgressiveFineResult {
    return this.execute(input);
  }

  static linear(basePercent?: number, dailyRate?: number, cap?: number): ProgressiveFineContext {
    return new ProgressiveFineContext(
      new LinearOverdueFineStrategy(basePercent, dailyRate, cap),
    );
  }

  static tiered(basePercent?: number, tiers?: TierConfig[], cap?: number): ProgressiveFineContext {
    return new ProgressiveFineContext(
      new TieredProgressiveFineStrategy(basePercent, tiers, cap),
    );
  }

  static compound(basePercent?: number, dailyRate?: number, cap?: number): ProgressiveFineContext {
    return new ProgressiveFineContext(
      new CompoundProgressiveFineStrategy(basePercent, dailyRate, cap),
    );
  }

  static regulatory(): ProgressiveFineContext {
    return new ProgressiveFineContext(new RegulatoryContractFineStrategy());
  }

  static fromType(type: 'linear' | 'tiered' | 'compound' | 'regulatory'): ProgressiveFineContext {
    switch (type) {
      case 'linear':
        return ProgressiveFineContext.linear();
      case 'tiered':
        return ProgressiveFineContext.tiered();
      case 'compound':
        return ProgressiveFineContext.compound();
      case 'regulatory':
        return ProgressiveFineContext.regulatory();
      default:
        throw new Error(`Tipo de estratégia de multa desconhecido: ${type}`);
    }
  }
}
