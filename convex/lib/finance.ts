/**
 * The shapes the Finances tables and their functions agree on.
 *
 * Every closed set here is declared once against the union `@gather/core`
 * defines, so the database, the functions and the screens cannot drift into
 * three different ideas of what a loan part or a cost category is. The
 * `satisfies` line under each is what makes adding a member of the union
 * without adding it here a compile error.
 *
 * Money is stored as an integer number of cents, everywhere, for the reason
 * `@gather/core/finance`'s `money.ts` gives.
 */

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

import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireGroupBySlug } from './groupAccess'

/** A `v.union` of literals, built from the seam's own tuple. */
function literals<T extends string>(values: readonly T[]) {
  // Convex's union needs at least two members, and every set here has more.
  const [first, second, ...rest] = values.map((value) => v.literal(value))
  return v.union(first, second, ...rest)
}

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

/** One Member's share of a standing cost, in whole percent. */
export const splitShareValidator = v.object({
  userId: v.id('users'),
  percent: v.number(),
})

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

export const netWorthRowValidator = v.object({
  kind: v.union(v.literal('asset'), v.literal('liability')),
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

/** Every Finances table, so the access helper below can name one. */
export type FinanceTable =
  | 'houses'
  | 'mortgageCalculations'
  | 'loanParts'
  | 'homeBuyingCosts'
  | 'recurringCosts'
  | 'savingsGoals'
  | 'splitScenarios'
  | 'holdings'
  | 'holdingTransactions'
  | 'netWorthEntries'
  | 'netWorthSnapshots'

/**
 * One Finances row, read through the Group the caller named.
 *
 * The row must live in *that* Group, for the reason `babyAccess` gives: a link
 * that claims something about a record and a Group which is not true answers
 * "not found", and "not found" is the same answer as "not yours" so that
 * neither can be used to discover the other.
 */
export async function findInGroup<T extends FinanceTable>(
  ctx: QueryCtx,
  groupSlug: string,
  id: Id<T>,
): Promise<{ user: Doc<'users'>; group: Doc<'groups'>; doc: Doc<T> } | null> {
  const { user, group } = await requireGroupBySlug(ctx, groupSlug)
  const doc = (await ctx.db.get(id)) as Doc<T> | null
  if (!doc || doc.groupId !== group._id) return null
  return { user, group, doc }
}

export async function requireInGroup<T extends FinanceTable>(
  ctx: QueryCtx,
  groupSlug: string,
  id: Id<T>,
) {
  const found = await findInGroup(ctx, groupSlug, id)
  if (!found) throw new ConvexError('Not found')
  return found
}

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new ConvexError('Date must be YYYY-MM-DD')
  return date
}

/** The next `order` for a Group's rows in one table. */
export function nextOrder(rows: readonly { order: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order), -1) + 1
}
