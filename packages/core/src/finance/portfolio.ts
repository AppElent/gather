/**
 * What a Group's holdings are worth, and what they have done — informationally.
 *
 * ADR-0026: an overview is information, not advice. Everything below is average
 * cost, which is the method that agrees with the way a holding is established
 * here — a dated opening position of units at an average price, rather than a
 * reconstructed history. It is not a tax figure and it is not a recommendation.
 *
 * A price and a conversion rate always arrive with the moment they were taken.
 * A refresh that fails keeps the last known figure and marks it stale, because
 * the last known value is still the honest one and hiding its age is the only
 * way to turn it into a lie.
 */

import { type Cents, roundCents } from './money'

export const HOLDING_KINDS = ['stock', 'etf'] as const
export type HoldingKind = (typeof HOLDING_KINDS)[number]

export const TRANSACTION_KINDS = [
  'buy',
  'sell',
  'dividend',
  'fee',
  'adjustment',
] as const
export type TransactionKind = (typeof TRANSACTION_KINDS)[number]

/** The dated position a holding starts from, in its trading currency. */
export interface OpeningPosition {
  /** `YYYY-MM-DD`. */
  date: string
  units: number
  averageCostCents: Cents
}

export interface HoldingTransaction {
  kind: TransactionKind
  /** `YYYY-MM-DD`. */
  date: string
  /** Buys and sales: how many units. Adjustments: the units the Member says are held. */
  units?: number
  /** Buys and sales: the price paid per unit. Adjustments: the new average cost. */
  pricePerUnitCents?: Cents
  /** Dividends: paid per unit held on the day. */
  perUnitCents?: Cents
  /** Buy/sell commission, or a standalone fee. */
  feeCents?: Cents
}

export interface HoldingPosition {
  units: number
  averageCostCents: Cents
  /** What the units still held cost, average cost. */
  investedCents: Cents
  realizedCents: Cents
  dividendsCents: Cents
  feesCents: Cents
}

/**
 * Walk the opening position and the transactions in date order.
 *
 * Sorted here rather than trusted from the caller: a Member enters a buy they
 * forgot about after a sale they already recorded, and average cost is one of
 * the methods where the order changes the answer.
 */
export function holdingPosition(
  opening: OpeningPosition,
  transactions: readonly HoldingTransaction[],
): HoldingPosition {
  let units = opening.units
  let basis = roundCents(opening.units * opening.averageCostCents)
  let realized = 0
  let dividends = 0
  let fees = 0

  const ordered = [...transactions].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  )

  for (const entry of ordered) {
    const fee = entry.feeCents ?? 0
    if (entry.kind === 'buy') {
      const quantity = entry.units ?? 0
      basis += roundCents(quantity * (entry.pricePerUnitCents ?? 0)) + fee
      units += quantity
      fees += fee
    } else if (entry.kind === 'sell') {
      const quantity = Math.min(entry.units ?? 0, units)
      const averageCost = units > 0 ? basis / units : 0
      const proceeds =
        roundCents(quantity * (entry.pricePerUnitCents ?? 0)) - fee
      realized += proceeds - roundCents(quantity * averageCost)
      basis -= roundCents(quantity * averageCost)
      units -= quantity
      fees += fee
    } else if (entry.kind === 'dividend') {
      dividends += roundCents(units * (entry.perUnitCents ?? 0))
    } else if (entry.kind === 'fee') {
      fees += fee
    } else {
      // A Member-entered correction for a split, merger or ETF change. It
      // states the position rather than describing an event, because Gather
      // does not process corporate actions (ADR-0025) and a rule it half
      // applied would be worse than one it never had.
      units = entry.units ?? units
      basis = roundCents(units * (entry.pricePerUnitCents ?? 0))
    }
    if (units <= 0) {
      units = Math.max(0, units)
      basis = units === 0 ? 0 : basis
    }
  }

  return {
    units,
    averageCostCents: units > 0 ? roundCents(basis / units) : 0,
    investedCents: basis,
    realizedCents: realized,
    dividendsCents: dividends,
    feesCents: fees,
  }
}

/** A price, and the moment it was taken. There is no price without one. */
export interface Quote {
  pricePerUnitCents: Cents
  /** Epoch milliseconds. */
  asOf: number
}

/** A conversion into the Group's home currency, and when it was taken. */
export interface FxRate {
  /** Home-currency units per one unit of the holding's currency. */
  rate: number
  asOf: number
}

/** How old a figure may be before the screen has to say so. */
export const STALE_AFTER_MS = 36 * 60 * 60 * 1000

export function isStale(
  asOf: number | null | undefined,
  now: number,
  maxAgeMs: number = STALE_AFTER_MS,
): boolean {
  if (asOf === null || asOf === undefined) return true
  return now - asOf > maxAgeMs
}

export interface ValuedHolding {
  id: string
  symbol: string
  currency: string
  position: HoldingPosition
  quote: Quote | null
  fx: FxRate | null
}

export interface HoldingValue {
  id: string
  /** In the holding's own trading currency. */
  marketValueCents: Cents
  /** In the Group's home currency. */
  homeValueCents: Cents
  unrealizedCents: Cents
  /** Null when nothing is invested, rather than a division by zero shown as 0 %. */
  unrealizedPercent: number | null
  /** No quote, or one older than the window. */
  stale: boolean
}

function convert(cents: Cents, fx: FxRate | null): Cents {
  return fx ? roundCents(cents * fx.rate) : cents
}

export function valueHolding(
  holding: ValuedHolding,
  now: number,
): HoldingValue {
  const price =
    holding.quote?.pricePerUnitCents ?? holding.position.averageCostCents
  const market = roundCents(holding.position.units * price)
  const unrealized = market - holding.position.investedCents
  return {
    id: holding.id,
    marketValueCents: market,
    homeValueCents: convert(market, holding.fx),
    unrealizedCents: convert(unrealized, holding.fx),
    unrealizedPercent:
      holding.position.investedCents > 0
        ? (unrealized / holding.position.investedCents) * 100
        : null,
    stale:
      holding.quote === null ||
      isStale(holding.quote.asOf, now) ||
      (holding.fx !== null && isStale(holding.fx.asOf, now)),
  }
}

export interface PortfolioTotals {
  /** Every holding, in the Group's home currency. */
  totalValueCents: Cents
  investedCents: Cents
  unrealizedCents: Cents
  unrealizedPercent: number | null
  realizedCents: Cents
  dividendsCents: Cents
  feesCents: Cents
  /** The oldest quote or rate behind the total. Null when there are none. */
  asOf: number | null
  /** True when any figure in the total is stale. */
  stale: boolean
  values: HoldingValue[]
}

export function portfolioTotals(
  holdings: readonly ValuedHolding[],
  now: number,
): PortfolioTotals {
  const values = holdings.map((holding) => valueHolding(holding, now))
  const invested = holdings.reduce(
    (sum, holding) => sum + convert(holding.position.investedCents, holding.fx),
    0,
  )
  const total = values.reduce((sum, value) => sum + value.homeValueCents, 0)
  const stamps = holdings
    .flatMap((holding) => [holding.quote?.asOf, holding.fx?.asOf])
    .filter((stamp): stamp is number => typeof stamp === 'number')

  return {
    totalValueCents: total,
    investedCents: invested,
    unrealizedCents: total - invested,
    unrealizedPercent:
      invested > 0 ? ((total - invested) / invested) * 100 : null,
    realizedCents: holdings.reduce(
      (sum, holding) =>
        sum + convert(holding.position.realizedCents, holding.fx),
      0,
    ),
    dividendsCents: holdings.reduce(
      (sum, holding) =>
        sum + convert(holding.position.dividendsCents, holding.fx),
      0,
    ),
    feesCents: holdings.reduce(
      (sum, holding) => sum + convert(holding.position.feesCents, holding.fx),
      0,
    ),
    asOf: stamps.length > 0 ? Math.min(...stamps) : null,
    stale: values.some((value) => value.stale),
    values,
  }
}
