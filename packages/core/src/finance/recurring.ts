/**
 * Repeating costs, turned into a monthly and an annual figure.
 *
 * Nothing here tracks a payment, a due date or a renewal (ADR-0025). A cost is
 * an amount and how often it comes round; a **split ratio** is how a household
 * divides it, and it is not a debt — nothing accrues and nothing settles.
 */

import { type Cents, roundCents, splitEvenly } from './money'

export const COST_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'halfYearly',
  'yearly',
] as const
export type CostFrequency = (typeof COST_FREQUENCIES)[number]

/** How many times a year each frequency comes round. */
const PER_YEAR: Record<CostFrequency, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  halfYearly: 2,
  yearly: 1,
}

/**
 * The categories a cost can carry. A closed set with an entry in both message
 * trees, so adding one without naming it is a compile error (ADR-0011).
 */
export const COST_CATEGORIES = [
  'housing',
  'utilities',
  'insurance',
  'transport',
  'health',
  'media',
  'other',
] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

/** One Member's share of a standing cost, in whole percent. */
export interface SplitShare {
  memberId: string
  percent: number
}

export interface RecurringCost {
  amountCents: Cents
  frequency: CostFrequency
  category: CostCategory
  /** Absent or empty means the cost is not divided. */
  split?: readonly SplitShare[]
}

export function annualCents(cost: {
  amountCents: Cents
  frequency: CostFrequency
}): Cents {
  return roundCents(cost.amountCents * PER_YEAR[cost.frequency])
}

export function monthlyCents(cost: {
  amountCents: Cents
  frequency: CostFrequency
}): Cents {
  return roundCents((cost.amountCents * PER_YEAR[cost.frequency]) / 12)
}

/**
 * A ratio is only usable once it adds to a hundred, so this is what the form
 * checks before it lets a split be saved.
 */
export function splitTotalsToHundred(split: readonly SplitShare[]): boolean {
  if (split.length === 0) return false
  return split.reduce((sum, share) => sum + share.percent, 0) === 100
}

/**
 * One Member's amount of a cost, in cents.
 *
 * The remainder is handed out a cent at a time rather than dropped, so the
 * shares always add back up to the cost — the arithmetic people check.
 */
export function shareOf(
  totalCents: Cents,
  split: readonly SplitShare[],
): Map<string, Cents> {
  const shares = new Map<string, Cents>()
  if (split.length === 0) return shares
  if (!splitTotalsToHundred(split)) {
    // An unusable ratio divides evenly rather than silently losing money.
    const even = splitEvenly(totalCents, split.length)
    split.forEach((share, index) => {
      shares.set(share.memberId, even[index])
    })
    return shares
  }

  let assigned = 0
  split.forEach((share, index) => {
    const amount =
      index === split.length - 1
        ? totalCents - assigned
        : roundCents((totalCents * share.percent) / 100)
    assigned += amount
    shares.set(share.memberId, amount)
  })
  return shares
}

export interface RecurringTotals {
  monthlyCents: Cents
  annualCents: Cents
  /** Per Member, across every cost that names them. */
  perMemberMonthlyCents: Map<string, Cents>
  byCategory: { category: CostCategory; monthlyCents: Cents }[]
}

/** The household's standing costs, added up the two ways it reads them. */
export function recurringTotals(
  costs: readonly RecurringCost[],
): RecurringTotals {
  const perMember = new Map<string, Cents>()
  const perCategory = new Map<CostCategory, Cents>()
  let monthly = 0

  for (const cost of costs) {
    const costMonthly = monthlyCents(cost)
    monthly += costMonthly
    perCategory.set(
      cost.category,
      (perCategory.get(cost.category) ?? 0) + costMonthly,
    )
    for (const [memberId, amount] of shareOf(costMonthly, cost.split ?? [])) {
      perMember.set(memberId, (perMember.get(memberId) ?? 0) + amount)
    }
  }

  return {
    monthlyCents: monthly,
    annualCents: costs.reduce((sum, cost) => sum + annualCents(cost), 0),
    perMemberMonthlyCents: perMember,
    byCategory: COST_CATEGORIES.filter((category) =>
      perCategory.has(category),
    ).map((category) => ({
      category,
      monthlyCents: perCategory.get(category) ?? 0,
    })),
  }
}
