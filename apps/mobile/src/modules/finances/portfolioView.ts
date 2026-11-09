/**
 * Turning stored holdings into the shape `@gather/core/finance` values.
 *
 * Two things this settles, and they are the two the Portfolio screen would
 * otherwise get wrong:
 *
 * - **A price and its age travel together.** A holding with no price has no
 *   quote at all rather than a quote of zero, which is what lets the screen say
 *   "no price yet" instead of drawing a holding as worthless.
 * - **The home currency is always the euro, and nothing converts.** A euro
 *   holding needs no rate — passing an identity rate would give the total a
 *   staleness it does not have. A holding stored in another currency from
 *   before that was settled is counted one-to-one and drawn stale, which is
 *   the honest reading of a figure nobody can convert.
 */

import type { FxRate, ValuedHolding } from '@gather/core/finance'
import { holdingPosition } from '@gather/core/finance'

export interface StoredHolding {
  _id: string
  symbol: string
  name: string
  currency: string
  openingDate: string
  openingUnits: number
  openingAverageCostCents: number
  lastPriceCents?: number
  lastPriceAt?: number
  transactions: {
    kind: 'buy' | 'sell' | 'dividend' | 'fee' | 'adjustment'
    date: string
    units?: number
    pricePerUnitCents?: number
    perUnitCents?: number
    feeCents?: number
  }[]
}

/** Every Group counts in euros; there is no setting and no conversion. */
export const HOME_CURRENCY = 'EUR'

/** One-to-one with an age of nothing: drawn, and drawn stale. */
const UNCONVERTED: FxRate = { rate: 1, asOf: 0 }

export function valuedHoldings(
  holdings: readonly StoredHolding[],
): ValuedHolding[] {
  return holdings.map((holding) => {
    const fx = holding.currency === HOME_CURRENCY ? null : UNCONVERTED

    return {
      id: holding._id,
      symbol: holding.symbol,
      currency: holding.currency,
      position: holdingPosition(
        {
          date: holding.openingDate,
          units: holding.openingUnits,
          averageCostCents: holding.openingAverageCostCents,
        },
        holding.transactions,
      ),
      quote:
        holding.lastPriceCents === undefined ||
        holding.lastPriceAt === undefined
          ? null
          : {
              pricePerUnitCents: holding.lastPriceCents,
              asOf: holding.lastPriceAt,
            },
      fx,
    }
  })
}
