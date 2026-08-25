/**
 * Between what a loan part is stored as and what the seam prices.
 *
 * The database keeps dates — the day a fix ends, the day a repayment falls —
 * because a stored count of months would quietly mean something different every
 * month nobody opened it. The seam counts months from now, because that is what
 * a schedule runs on. This is the one place that translation happens.
 */

import type { LoanPart, LoanPartKind } from '@gather/core/finance'
import { monthsUntil, todayIso } from '@gather/core/finance'

/** A loan part as `convex/loanParts` stores it. */
export interface StoredLoanPart {
  kind: LoanPartKind
  principalCents: number
  annualRatePercent: number
  termMonths: number
  fixedUntil?: string
  expiryRatePercent?: number
  expiryRateOptions?: number[]
  repayments?: {
    kind: 'once' | 'monthly'
    amountCents: number
    date: string
  }[]
  charge?: { freeAnnualPercent: number; chargePercent: number }
}

export function toLoanPart(
  stored: StoredLoanPart,
  today: string = todayIso(),
): LoanPart {
  const part: LoanPart = {
    kind: stored.kind,
    principalCents: stored.principalCents,
    annualRatePercent: stored.annualRatePercent,
    termMonths: stored.termMonths,
    expiryRatePercent: stored.expiryRatePercent,
    // A repayment dated before today starts in month 1 rather than being
    // dropped: a household that set up a standing order last year is still
    // paying it, and a schedule that ignored it would answer a different
    // question from the one the screen asks.
    repayments: (stored.repayments ?? []).map((repayment) => ({
      kind: repayment.kind,
      amountCents: repayment.amountCents,
      month: Math.max(1, monthsUntil(today, repayment.date) + 1),
    })),
    charge: stored.charge,
  }
  // A fix that has already run out is no fix at all: `monthsUntil` floors at
  // zero, so the rate the Member entered for afterwards applies from month one.
  if (stored.fixedUntil)
    part.fixedUntilMonth = monthsUntil(today, stored.fixedUntil)
  return part
}

export function toLoanParts(
  stored: readonly StoredLoanPart[],
  today: string = todayIso(),
): LoanPart[] {
  return stored.map((part) => toLoanPart(part, today))
}

/** A term in months, said the way a household says it. */
export function termWords(
  months: number,
  words: { years: string; months: string },
): string {
  if (months >= 24 && months % 12 === 0)
    return words.years.replace('{years}', String(Math.round(months / 12)))
  return words.months.replace('{months}', String(months))
}
