/**
 * A savings goal: a target, a date, and what somebody typed in as saved so far.
 *
 * Gather reads nothing from an account (ADR-0025). The two figures it produces
 * — what a month has to be to make the date, and when the current pace arrives
 * — are calculated rather than entered, and they are the whole point of the
 * screen.
 */

import { addMonths, monthsUntil } from './dates'
import { type Cents, roundCents } from './money'

export interface SavingsGoal {
  targetCents: Cents
  savedCents: Cents
  /** `YYYY-MM-DD`. */
  targetDate: string
  /** What the household plans to put aside each month. Absent means not yet said. */
  monthlyCents?: Cents
}

export interface SavingsProgress {
  remainingCents: Cents
  /** 0–1. A goal already met stays at 1 rather than running over. */
  fraction: number
  reached: boolean
  /** What a month has to be to make the target date. Null once it is reached. */
  requiredMonthlyCents: Cents | null
  /** Months from today to the target date. */
  monthsRemaining: number
  /** Where the current pace arrives, `YYYY-MM-DD`. Null without a pace. */
  expectedDate: string | null
  /** True when the current pace does not make the target date. */
  behind: boolean
}

export function savingsProgress(
  goal: SavingsGoal,
  today: string,
): SavingsProgress {
  const remaining = Math.max(0, goal.targetCents - goal.savedCents)
  const reached = remaining === 0
  const fraction =
    goal.targetCents <= 0
      ? 1
      : Math.min(1, Math.max(0, goal.savedCents / goal.targetCents))
  const monthsRemaining = monthsUntil(today, goal.targetDate)

  // A target date that has arrived needs the whole remainder now rather than a
  // division by zero.
  const requiredMonthlyCents = reached
    ? null
    : monthsRemaining === 0
      ? remaining
      : roundCents(remaining / monthsRemaining)

  const pace = goal.monthlyCents ?? 0
  const monthsAtPace = pace > 0 ? Math.ceil(remaining / pace) : null
  const expectedDate = reached
    ? today
    : monthsAtPace === null
      ? null
      : addMonths(today, monthsAtPace)

  return {
    remainingCents: remaining,
    fraction,
    reached,
    requiredMonthlyCents,
    monthsRemaining,
    expectedDate,
    behind: !reached && monthsAtPace !== null && monthsAtPace > monthsRemaining,
  }
}
