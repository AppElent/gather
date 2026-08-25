/**
 * Net worth: what a household owns, minus what it owes, on a day it chose.
 *
 * ADR-0025: the current view derives three rows rather than asking for them
 * again — the House's value, that House's mortgage balance, and the Portfolio's
 * calculated value — and everything else is a figure a Member typed. There is
 * no background valuation and no scheduled history: a snapshot exists because
 * somebody took one, and it freezes the derived rows too, including the moment
 * the prices came from.
 */

import type { Cents } from './money'

export type NetWorthRowKind = 'asset' | 'liability'

/** Where a row's figure came from. A derived row is calculated, never typed. */
export type NetWorthSource = 'manual' | 'house' | 'mortgage' | 'portfolio'

export interface NetWorthRow {
  kind: NetWorthRowKind
  source: NetWorthSource
  label: string
  /** Always positive. `kind` is what decides which way it counts. */
  amountCents: Cents
  /** What the figure is as at, where it has one — a price time, a valuation date. */
  asOf?: string
}

export interface NetWorthTotals {
  assetsCents: Cents
  liabilitiesCents: Cents
  netCents: Cents
}

export function netWorthTotals(rows: readonly NetWorthRow[]): NetWorthTotals {
  const assets = rows
    .filter((row) => row.kind === 'asset')
    .reduce((sum, row) => sum + row.amountCents, 0)
  const liabilities = rows
    .filter((row) => row.kind === 'liability')
    .reduce((sum, row) => sum + row.amountCents, 0)
  return {
    assetsCents: assets,
    liabilitiesCents: liabilities,
    netCents: assets - liabilities,
  }
}

/** The change since a previous snapshot, or null when there is not one yet. */
export function changeSince(
  currentNetCents: Cents,
  previousNetCents: Cents | null | undefined,
): Cents | null {
  if (previousNetCents === null || previousNetCents === undefined) return null
  return currentNetCents - previousNetCents
}
