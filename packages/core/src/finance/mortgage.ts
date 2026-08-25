/**
 * A mortgage is not one loan.
 *
 * ADR-0025: a Mortgage calculation is made of **loan parts**, each with its own
 * amount, structure, rate, fixed-rate end and remaining term, each priced on
 * its own, with the calculation's totals being their sum. Extra repayments and
 * the optional early-repayment charge belong to the part whose interest they
 * change, which is why they hang off `LoanPart` rather than off the calculation.
 *
 * Everything here is arithmetic on figures a Member typed. There is no rate
 * forecast, no lender's terms and no affordability test: the rate that applies
 * after a fix ends is one the Member entered on that part, and a charge is one
 * they read off their own contract.
 */

import { type Cents, monthlyRate, roundCents } from './money'

export const LOAN_PART_KINDS = ['annuity', 'linear', 'interestOnly'] as const
export type LoanPartKind = (typeof LOAN_PART_KINDS)[number]

export interface ExtraRepayment {
  /** `once` pays in `month`; `monthly` pays in that month and every one after. */
  kind: 'once' | 'monthly'
  amountCents: Cents
  /** Months from the start of the calculation. Month 1 is the first payment. */
  month: number
}

/**
 * What the lender charges for repaying faster than the contract allows —
 * looked up by the Member, never guessed by Gather.
 */
export interface EarlyRepaymentCharge {
  /** Share of the original principal that may be repaid free in a year. */
  freeAnnualPercent: number
  /** Charged on whatever is repaid above that allowance in the same year. */
  chargePercent: number
}

export interface LoanPart {
  kind: LoanPartKind
  principalCents: Cents
  /** Nominal annual interest, as written: `3.9` means 3.90 %. */
  annualRatePercent: number
  /** Months this part still has to run. */
  termMonths: number
  /** Months until the fixed rate ends. Absent means it never refixes. */
  fixedUntilMonth?: number
  /** The rate the Member says applies from then on. Absent keeps the current one. */
  expiryRatePercent?: number
  repayments?: readonly ExtraRepayment[]
  charge?: EarlyRepaymentCharge
}

export interface PartSchedule {
  /** What this part costs in its first month. */
  monthlyPaymentCents: Cents
  /** Every month's payment, index 0 being month 1. */
  paymentByMonth: Cents[]
  totalInterestCents: Cents
  /** Early-repayment charges incurred; zero when the part carries no charge. */
  totalChargeCents: Cents
  /** The month the balance reaches zero. */
  monthsToPayOff: number
}

/** Nothing runs longer than this, whatever a Member typed. */
const MAX_MONTHS = 1200

/** The level payment that clears `balance` over `months` at `rate` a month. */
export function annuityPayment(
  balanceCents: Cents,
  rate: number,
  months: number,
): Cents {
  if (months <= 0) return balanceCents
  if (rate === 0) return roundCents(balanceCents / months)
  const factor = (1 + rate) ** -months
  return roundCents((balanceCents * rate) / (1 - factor))
}

function repaymentDue(
  repayments: readonly ExtraRepayment[],
  month: number,
): Cents {
  let due = 0
  for (const repayment of repayments) {
    if (repayment.kind === 'once' && repayment.month === month)
      due += repayment.amountCents
    if (repayment.kind === 'monthly' && month >= repayment.month)
      due += repayment.amountCents
  }
  return due
}

/**
 * Run one part month by month.
 *
 * Simulated rather than solved in closed form because extra repayments, a
 * refix part-way through and a per-year free allowance do not have one — and a
 * schedule a Member can be shown a row of is worth more than an elegant
 * formula they cannot check.
 */
export function schedulePart(part: LoanPart): PartSchedule {
  const term = Math.max(1, Math.min(Math.round(part.termMonths), MAX_MONTHS))
  const repayments = part.repayments ?? []
  const original = part.principalCents

  let balance = original
  let rate = monthlyRate(part.annualRatePercent)
  let payment =
    part.kind === 'annuity' ? annuityPayment(balance, rate, term) : 0
  // Linear repays the same slice of the original principal every month, and an
  // extra repayment shortens the loan rather than shrinking that slice.
  const linearSlice = part.kind === 'linear' ? Math.ceil(original / term) : 0

  const paymentByMonth: Cents[] = []
  let totalInterest = 0
  let totalCharge = 0
  let repaidThisYear = 0
  let monthsToPayOff = term

  for (let month = 1; month <= term; month++) {
    if (month % 12 === 1) repaidThisYear = 0

    if (
      part.fixedUntilMonth !== undefined &&
      month === part.fixedUntilMonth + 1
    ) {
      rate = monthlyRate(part.expiryRatePercent ?? part.annualRatePercent)
      if (part.kind === 'annuity')
        payment = annuityPayment(balance, rate, term - month + 1)
    }

    const interest = roundCents(balance * rate)
    let principalPortion = 0
    if (part.kind === 'annuity')
      principalPortion = Math.min(Math.max(payment - interest, 0), balance)
    if (part.kind === 'linear')
      principalPortion = Math.min(linearSlice, balance)
    // The last month clears whatever rounding left behind, so the payments add
    // up to the principal plus the interest rather than to a euro or two less.
    // Interest-only is exempt: its principal falls due as a lump the household
    // arranges separately, and calling that a monthly payment would be a lie.
    if (month === term && part.kind !== 'interestOnly')
      principalPortion = balance

    const extra = Math.max(
      0,
      Math.min(repaymentDue(repayments, month), balance - principalPortion),
    )

    let charge = 0
    if (part.charge && extra > 0) {
      const allowance = roundCents(
        (original * part.charge.freeAnnualPercent) / 100,
      )
      const chargeableBefore = Math.max(0, repaidThisYear - allowance)
      const chargeableAfter = Math.max(0, repaidThisYear + extra - allowance)
      charge = roundCents(
        ((chargeableAfter - chargeableBefore) * part.charge.chargePercent) /
          100,
      )
    }
    repaidThisYear += extra

    totalInterest += interest
    totalCharge += charge
    paymentByMonth.push(interest + principalPortion + extra + charge)
    balance -= principalPortion + extra

    if (balance <= 0 || month === term) {
      balance = 0
      monthsToPayOff = month
      break
    }
  }

  return {
    monthlyPaymentCents: paymentByMonth[0] ?? 0,
    paymentByMonth,
    totalInterestCents: totalInterest,
    totalChargeCents: totalCharge,
    monthsToPayOff,
  }
}

export interface CalculationTotals {
  /** What every part together costs in the first month. */
  monthlyCents: Cents
  outstandingCents: Cents
  totalInterestCents: Cents
  totalChargeCents: Cents
  /** The month the last part is paid off. */
  lastPayoffMonth: number
  schedules: PartSchedule[]
}

export function calculationTotals(
  parts: readonly LoanPart[],
): CalculationTotals {
  const schedules = parts.map(schedulePart)
  return {
    monthlyCents: schedules.reduce((sum, s) => sum + s.monthlyPaymentCents, 0),
    outstandingCents: parts.reduce((sum, p) => sum + p.principalCents, 0),
    totalInterestCents: schedules.reduce(
      (sum, s) => sum + s.totalInterestCents,
      0,
    ),
    totalChargeCents: schedules.reduce((sum, s) => sum + s.totalChargeCents, 0),
    lastPayoffMonth: schedules.reduce(
      (max, s) => Math.max(max, s.monthsToPayOff),
      0,
    ),
    schedules,
  }
}

/** Why one part's contribution changed in a given month. */
export type StepReason = 'refix' | 'paidOff' | 'repayment'

export interface MortgageStep {
  /** Months from the start of the calculation. Month 1 is today's payment. */
  month: number
  monthlyCents: Cents
  /** Change from the step before. Zero on the first step. */
  deltaCents: Cents
  changes: { partIndex: number; reason: StepReason }[]
}

/**
 * The fixed-rate-expiry answer, which is a series of dated steps rather than
 * one figure (ADR-0025): each part's fix ends on its own date, so what a
 * household wants to know is when the total moves and by how much.
 *
 * Built from the events that move it — a fix ending, a repayment starting, a
 * part being paid off — rather than from the months in which the total happens
 * to differ. A linear part falls by a euro or so every single month, so a
 * diff would answer with two hundred steps and say nothing.
 */
export function mortgageSteps(parts: readonly LoanPart[]): MortgageStep[] {
  const schedules = parts.map(schedulePart)
  const horizon = schedules.reduce(
    (max, s) => Math.max(max, s.monthsToPayOff),
    0,
  )
  if (horizon === 0) return []

  const at = (schedule: PartSchedule, month: number) =>
    schedule.paymentByMonth[month - 1] ?? 0

  // Month 1 is always a step: it is what the household pays today.
  const events = new Map<number, { partIndex: number; reason: StepReason }[]>([
    [1, []],
  ])
  const note = (
    month: number,
    change: { partIndex: number; reason: StepReason },
  ) => {
    if (month <= 1 || month > horizon) return
    const existing = events.get(month)
    if (existing) existing.push(change)
    else events.set(month, [change])
  }

  parts.forEach((part, partIndex) => {
    if (part.fixedUntilMonth !== undefined)
      note(part.fixedUntilMonth + 1, { partIndex, reason: 'refix' })
    for (const repayment of part.repayments ?? [])
      note(repayment.month, { partIndex, reason: 'repayment' })
    note(schedules[partIndex].monthsToPayOff + 1, {
      partIndex,
      reason: 'paidOff',
    })
  })

  const steps: MortgageStep[] = []
  let previous: Cents | null = null
  for (const month of [...events.keys()].sort((a, b) => a - b)) {
    const total = schedules.reduce((sum, s) => sum + at(s, month), 0)
    steps.push({
      month,
      monthlyCents: total,
      deltaCents: previous === null ? 0 : total - previous,
      changes: events.get(month) ?? [],
    })
    previous = total
  }
  return steps
}
