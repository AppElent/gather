/**
 * One call from stored holdings to the Portfolio's totals.
 *
 * Two screens need this — the index row and the Portfolio itself — and a second
 * implementation of "what is it all worth" is exactly the drift ADR-0026's
 * information-not-advice rule cannot afford.
 */

import type { PortfolioTotals } from '@gather/core/finance'
import { portfolioTotals } from '@gather/core/finance'

import { type StoredHolding, valuedHoldings } from './portfolioView'

export function portfolioTotalsFor(
  holdings: readonly StoredHolding[],
  now: number = Date.now(),
): PortfolioTotals {
  return portfolioTotals(valuedHoldings(holdings), now)
}
