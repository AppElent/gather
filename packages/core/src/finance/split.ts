/**
 * Shared costs — the only disposable calculator left in Finances (ADR-0025).
 *
 * One event, several people who paid parts of it, and the transfers that even
 * it out. It creates no debt, no balance, no settlement and no history: the
 * answer is arithmetic on what was typed, and closing the screen is meant to
 * lose it unless somebody saved it.
 */

import { type Cents, splitEvenly } from './money'

export interface EventPayment {
  memberId: string
  amountCents: Cents
  /** What this payment was for — a label, never a category. */
  label?: string
}

export type SplitMode = 'equal' | 'custom'

export interface SplitInput {
  payments: readonly EventPayment[]
  /** Who the event is divided between. Not everyone who paid has to be here. */
  participantIds: readonly string[]
  mode: SplitMode
  /** Required by `custom`, and must add up to the total that was paid. */
  customCents?: Readonly<Record<string, Cents>>
}

/** One person moving money to one other person, once. */
export interface Transfer {
  fromMemberId: string
  toMemberId: string
  amountCents: Cents
}

export interface SplitResult {
  totalCents: Cents
  /** What each participant owes for the event. */
  owedCents: Map<string, Cents>
  /** What each person paid minus what they owe. Positive means owed money. */
  balanceCents: Map<string, Cents>
  transfers: Transfer[]
}

/**
 * Who should move what to whom.
 *
 * Greedy on the largest creditor and the largest debtor, which for a household
 * event is both the fewest transfers and the ones people expect: the person who
 * booked the chalet gets paid back by each of the others, not a chain.
 */
function settle(balances: Map<string, Cents>): Transfer[] {
  const creditors = [...balances]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([memberId, amount]) => ({ memberId, amount }))
  const debtors = [...balances]
    .filter(([, amount]) => amount < 0)
    .sort((a, b) => a[1] - b[1])
    .map(([memberId, amount]) => ({ memberId, amount: -amount }))

  const transfers: Transfer[] = []
  let c = 0
  let d = 0
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].amount, debtors[d].amount)
    if (amount > 0) {
      transfers.push({
        fromMemberId: debtors[d].memberId,
        toMemberId: creditors[c].memberId,
        amountCents: amount,
      })
    }
    creditors[c].amount -= amount
    debtors[d].amount -= amount
    if (creditors[c].amount === 0) c++
    if (debtors[d].amount === 0) d++
  }
  return transfers
}

export function splitEvent(input: SplitInput): SplitResult {
  const total = input.payments.reduce((sum, p) => sum + p.amountCents, 0)
  const participants = [...new Set(input.participantIds)]

  const owed = new Map<string, Cents>()
  if (input.mode === 'custom') {
    for (const memberId of participants) {
      owed.set(memberId, input.customCents?.[memberId] ?? 0)
    }
  } else {
    const even = splitEvenly(total, participants.length)
    participants.forEach((memberId, index) => {
      owed.set(memberId, even[index])
    })
  }

  const balances = new Map<string, Cents>()
  for (const memberId of participants) balances.set(memberId, 0)
  for (const payment of input.payments) {
    balances.set(
      payment.memberId,
      (balances.get(payment.memberId) ?? 0) + payment.amountCents,
    )
  }
  for (const [memberId, amount] of owed) {
    balances.set(memberId, (balances.get(memberId) ?? 0) - amount)
  }

  return {
    totalCents: total,
    owedCents: owed,
    balanceCents: balances,
    transfers: settle(balances),
  }
}

/**
 * Whether a custom allocation is usable: it has to hand out exactly what was
 * paid, or the transfers would invent or lose money.
 */
export function customCoversTotal(input: SplitInput): boolean {
  if (input.mode !== 'custom') return true
  const total = input.payments.reduce((sum, p) => sum + p.amountCents, 0)
  const allocated = [...new Set(input.participantIds)].reduce(
    (sum, memberId) => sum + (input.customCents?.[memberId] ?? 0),
    0,
  )
  return allocated === total
}
