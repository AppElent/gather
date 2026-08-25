/**
 * The rows Net worth derives rather than asks for again.
 *
 * ADR-0025: the current view derives three — the House's value, that House's
 * mortgage balance, and the Portfolio's calculated value — and everything else
 * is a figure a Member typed. Deriving them is what stops a household entering
 * a mortgage balance they already modelled part by part, and getting a
 * different number.
 *
 * Pure, and separate from the screen, because "which rows are derived" is the
 * rule worth a test rather than the layout that draws them.
 */

import type { NetWorthRow } from '@gather/core/finance'

export interface HouseForNetWorth {
  name: string
  valueCents?: number
  valueAsOf?: string
  /** The outstanding balance of this House's first mortgage calculation. */
  mortgageOutstandingCents?: number
}

export interface ManualEntry {
  kind: 'asset' | 'liability'
  label: string
  amountCents: number
}

export interface DerivedInput {
  houses: readonly HouseForNetWorth[]
  /** The Portfolio's value in the Group's home currency, or null with no holdings. */
  portfolioCents: number | null
  /** When the prices behind that value were taken. */
  portfolioAsOf?: string
  manual: readonly ManualEntry[]
  labels: { portfolio: string; mortgage: string }
}

/**
 * Every row the current view shows, derived ones first.
 *
 * A House with no value contributes nothing rather than a zero: "we have not
 * said what it is worth" and "it is worth nothing" are different answers, and
 * only one of them belongs in a total.
 */
export function netWorthRows(input: DerivedInput): NetWorthRow[] {
  const rows: NetWorthRow[] = []

  for (const house of input.houses) {
    if (house.valueCents !== undefined && house.valueCents > 0) {
      rows.push({
        kind: 'asset',
        source: 'house',
        label: house.name,
        amountCents: house.valueCents,
        asOf: house.valueAsOf,
      })
    }
  }

  if (input.portfolioCents !== null) {
    rows.push({
      kind: 'asset',
      source: 'portfolio',
      label: input.labels.portfolio,
      amountCents: input.portfolioCents,
      asOf: input.portfolioAsOf,
    })
  }

  for (const entry of input.manual) {
    if (entry.kind !== 'asset') continue
    rows.push({
      kind: 'asset',
      source: 'manual',
      label: entry.label,
      amountCents: entry.amountCents,
    })
  }

  for (const house of input.houses) {
    if (
      house.mortgageOutstandingCents !== undefined &&
      house.mortgageOutstandingCents > 0
    ) {
      rows.push({
        kind: 'liability',
        source: 'mortgage',
        label: `${input.labels.mortgage} — ${house.name}`,
        amountCents: house.mortgageOutstandingCents,
      })
    }
  }

  for (const entry of input.manual) {
    if (entry.kind !== 'liability') continue
    rows.push({
      kind: 'liability',
      source: 'manual',
      label: entry.label,
      amountCents: entry.amountCents,
    })
  }

  return rows
}
