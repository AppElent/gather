/**
 * Turning stored holdings into the shape `@gather/core/finance` values.
 *
 * Two things this settles, and they are the two the Portfolio screen would
 * otherwise get wrong:
 *
 * - **A price and its age travel together.** A holding with no price has no
 *   quote at all rather than a quote of zero, which is what lets the screen say
 *   "no price yet" instead of drawing a holding as worthless.
 * - **A foreign holding needs a conversion the Group entered**, and its own
 *   age. A holding already in the home currency needs none — passing an
 *   identity rate would give the total a staleness it does not have.
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

export interface StoredRate {
  currency: string
  rate: number
  asOf: number
}

export function valuedHoldings(
  holdings: readonly StoredHolding[],
  homeCurrency: string,
  rates: readonly StoredRate[],
): ValuedHolding[] {
  return holdings.map((holding) => {
    const fx: FxRate | null =
      holding.currency === homeCurrency
        ? null
        : (rates.find((rate) => rate.currency === holding.currency) ?? {
            // No conversion entered yet. One-to-one with an age of nothing is
            // the honest placeholder: the total is drawn, and it is drawn
            // stale, which is exactly what a missing rate means.
            rate: 1,
            asOf: 0,
          })

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
