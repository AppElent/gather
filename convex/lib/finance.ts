/**
 * The shapes the Finances tables and their functions agree on.
 *
 * Every closed set here is derived from the tuple `@gather/core` defines, so
 * the database, the functions and the screens cannot drift into three different
 * ideas of what a loan part or a cost category is.
 *
 * Money is stored as an integer number of cents, everywhere, for the reason
 * `@gather/core/finance`'s `money.ts` gives.
 */

import { isIsoDate } from '@gather/core/civil-date'
import {
  BUYING_COST_LINES,
  COST_CATEGORIES,
  COST_FREQUENCIES,
  HOLDING_KINDS,
  LOAN_PART_KINDS,
  TRANSACTION_KINDS,
  TRANSFER_TAX_BANDS,
} from '@gather/core/finance'
import { ConvexError, v } from 'convex/values'
import { literals } from './validators'

export const loanPartKindValidator = literals(LOAN_PART_KINDS)
export const costFrequencyValidator = literals(COST_FREQUENCIES)
export const costCategoryValidator = literals(COST_CATEGORIES)
export const transferTaxBandValidator = literals(TRANSFER_TAX_BANDS)
export const holdingKindValidator = literals(HOLDING_KINDS)
export const transactionKindValidator = literals(TRANSACTION_KINDS)

/** An extra repayment, dated rather than counted in months from now. */
export const repaymentValidator = v.object({
  kind: v.union(v.literal('once'), v.literal('monthly')),
  amountCents: v.number(),
  /** `YYYY-MM-DD`. The month it falls in is what the schedule uses. */
  date: v.string(),
})

export const chargeValidator = v.object({
  freeAnnualPercent: v.number(),
  chargePercent: v.number(),
})

/** A mortgage part, in the table and on the writes that add and change one. */
export const loanPartFields = {
  kind: loanPartKindValidator,
  principalCents: v.number(),
  annualRatePercent: v.number(),
  termMonths: v.number(),
  // The date the fix ends, rather than a count of months: a stored count
  // would quietly mean something different every month it was not opened.
  fixedUntil: v.optional(v.string()), // YYYY-MM-DD
  // What the Member says the rate becomes then, and the other figures they
  // wanted to compare against. Gather forecasts nothing.
  expiryRatePercent: v.optional(v.number()),
  expiryRateOptions: v.optional(v.array(v.number())),
  repayments: v.optional(v.array(repaymentValidator)),
  charge: v.optional(chargeValidator),
}

/** One Member's share of a standing cost, in whole percent. */
export const splitShareValidator = v.object({
  userId: v.id('users'),
  percent: v.number(),
})

/** A standing cost, in the table and on the writes that add and change one. */
export const recurringCostFields = {
  name: v.string(),
  amountCents: v.number(),
  frequency: costFrequencyValidator,
  category: costCategoryValidator,
  note: v.optional(v.string()),
  // How the Group divides it. A ratio, never a debt - nothing accrues and
  // nothing settles. Absent or empty means the cost is not divided.
  split: v.optional(v.array(splitShareValidator)),
}

export const buyingCostLinesValidator = v.object(
  Object.fromEntries(
    BUYING_COST_LINES.map((line) => [line, v.optional(v.number())]),
  ) as Record<
    (typeof BUYING_COST_LINES)[number],
    ReturnType<typeof v.optional>
  >,
)

/**
 * A payment or a participant in a saved Shared costs split.
 *
 * The Member's *name* is stored beside their id on purpose: a saved split is
 * immutable, so it has to keep reading correctly after somebody leaves the
 * Group. The id is what a screen matches on while they are still in it.
 */
export const splitPartyValidator = v.object({
  userId: v.optional(v.id('users')),
  name: v.string(),
})

/** A saved Shared costs result, in the table and on the write that saves one. */
export const splitScenarioFields = {
  name: v.string(),
  // Members are snapshotted by name as well as by id, so a saved split still
  // reads correctly after somebody leaves the Group.
  payments: v.array(
    v.object({
      party: splitPartyValidator,
      amountCents: v.number(),
      label: v.optional(v.string()),
    }),
  ),
  participants: v.array(splitPartyValidator),
  mode: v.union(v.literal('equal'), v.literal('custom')),
  // Frozen results rather than inputs to recompute: the Members and their
  // ids may be gone, and a scenario that recalculated would stop being the
  // thing that was saved.
  owed: v.array(
    v.object({ party: splitPartyValidator, amountCents: v.number() }),
  ),
  transfers: v.array(
    v.object({
      from: splitPartyValidator,
      to: splitPartyValidator,
      amountCents: v.number(),
    }),
  ),
  totalCents: v.number(),
}

/** A Portfolio position, in the table and on the write that opens one. */
export const holdingFields = {
  kind: holdingKindValidator,
  // Enough to name one instrument rather than one ticker: the same symbol
  // trades in two currencies on two exchanges, and a Portfolio that cannot
  // tell them apart is one that adds dollars to euros.
  symbol: v.string(),
  name: v.string(),
  exchange: v.optional(v.string()),
  currency: v.string(),
  // The dated position everything else is built on.
  openingDate: v.string(), // YYYY-MM-DD
  openingUnits: v.number(),
  openingAverageCostCents: v.number(),
  // The last price anybody has, and the moment it is as at. There is no
  // price without one, and a refresh that fails leaves both alone so the
  // screen can say how old the figure is instead of blanking it.
  lastPriceCents: v.optional(v.number()),
}

/** A dated Portfolio event, in the table and on the write that adds one. */
export const holdingTransactionFields = {
  kind: transactionKindValidator,
  date: v.string(), // YYYY-MM-DD
  units: v.optional(v.number()),
  pricePerUnitCents: v.optional(v.number()),
  perUnitCents: v.optional(v.number()),
  feeCents: v.optional(v.number()),
  note: v.optional(v.string()),
}

export const netWorthKindValidator = v.union(
  v.literal('asset'),
  v.literal('liability'),
)

export const netWorthRowValidator = v.object({
  kind: netWorthKindValidator,
  source: v.union(
    v.literal('manual'),
    v.literal('house'),
    v.literal('mortgage'),
    v.literal('portfolio'),
  ),
  label: v.string(),
  amountCents: v.number(),
  asOf: v.optional(v.string()),
})

/** A figure a Member typed still has to be a number, and usually a positive one. */
export function requireAmount(cents: number, { allowZero = true } = {}) {
  if (!Number.isFinite(cents) || !Number.isInteger(cents))
    throw new ConvexError('Amount must be a whole number of cents')
  if (cents < 0) throw new ConvexError('Amount cannot be negative')
  if (!allowZero && cents === 0) throw new ConvexError('Amount cannot be zero')
  return cents
}

export function requirePercent(percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    throw new ConvexError('Percentage must be between 0 and 100')
  return percent
}

export function requireName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new ConvexError('Name cannot be empty')
  return trimmed
}

/** `YYYY-MM-DD`, or a refusal. Dates are compared as strings everywhere here. */
export function requireIsoDate(date: string) {
  if (!isIsoDate(date)) throw new ConvexError('Date must be YYYY-MM-DD')
  return date
}