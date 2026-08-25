import { describe, expect, it } from 'vitest'
import { monthlyRate, toCents } from '../money'
import {
  annuityPayment,
  calculationTotals,
  type LoanPart,
  mortgageSteps,
  schedulePart,
} from '../mortgage'

const annuity: LoanPart = {
  kind: 'annuity',
  principalCents: toCents(180_000),
  annualRatePercent: 3.9,
  termMonths: 360,
}

describe('annuityPayment', () => {
  it('matches the closed-form payment for a standard 30-year loan', () => {
    // €180,000 at 3.90 % over 30 years is €849.00 a month.
    expect(annuityPayment(toCents(180_000), monthlyRate(3.9), 360)).toBe(84_900)
  })

  it('divides evenly when the rate is zero', () => {
    expect(annuityPayment(toCents(1200), 0, 12)).toBe(toCents(100))
  })
})

describe('schedulePart', () => {
  it('runs an annuity to a zero balance over its term', () => {
    const schedule = schedulePart(annuity)
    expect(schedule.monthsToPayOff).toBe(360)
    expect(schedule.monthlyPaymentCents).toBe(84_900)
    // Total interest is the sum of payments less the principal, within the
    // cent of rounding the final payment absorbs.
    const paid = schedule.paymentByMonth.reduce((sum, cents) => sum + cents, 0)
    expect(paid - annuity.principalCents).toBeCloseTo(
      schedule.totalInterestCents,
      -2,
    )
  })

  it('prices a linear part as a falling payment', () => {
    const schedule = schedulePart({
      kind: 'linear',
      principalCents: toCents(120_000),
      annualRatePercent: 3,
      termMonths: 240,
    })
    // €500 of principal plus €300 of interest in the first month.
    expect(schedule.monthlyPaymentCents).toBe(toCents(800))
    expect(schedule.paymentByMonth[1]).toBeLessThan(schedule.paymentByMonth[0])
    expect(schedule.monthsToPayOff).toBe(240)
  })

  it('charges interest only, and stops at the end of the term', () => {
    const schedule = schedulePart({
      kind: 'interestOnly',
      principalCents: toCents(70_000),
      annualRatePercent: 4.4,
      termMonths: 120,
    })
    expect(schedule.monthlyPaymentCents).toBe(25_667)
    expect(schedule.paymentByMonth[119]).toBe(25_667)
    expect(schedule.monthsToPayOff).toBe(120)
  })

  it('shortens an annuity when a monthly overpayment is added', () => {
    const plain = schedulePart(annuity)
    const overpaid = schedulePart({
      ...annuity,
      repayments: [{ kind: 'monthly', amountCents: toCents(200), month: 1 }],
    })
    expect(overpaid.monthsToPayOff).toBeLessThan(plain.monthsToPayOff)
    expect(overpaid.totalInterestCents).toBeLessThan(plain.totalInterestCents)
    expect(overpaid.monthlyPaymentCents).toBe(
      plain.monthlyPaymentCents + toCents(200),
    )
  })

  it('takes a one-off repayment in its own month only', () => {
    const schedule = schedulePart({
      ...annuity,
      repayments: [{ kind: 'once', amountCents: toCents(10_000), month: 13 }],
    })
    expect(schedule.paymentByMonth[12]).toBeGreaterThan(toCents(10_000))
    expect(schedule.paymentByMonth[13]).toBeLessThan(toCents(1000))
  })

  it('charges only what is repaid above the free annual allowance', () => {
    // 10 % of €180,000 is free; a €25,000 repayment is €7,000 over, at 1.5 %.
    const schedule = schedulePart({
      ...annuity,
      repayments: [{ kind: 'once', amountCents: toCents(25_000), month: 6 }],
      charge: { freeAnnualPercent: 10, chargePercent: 1.5 },
    })
    expect(schedule.totalChargeCents).toBe(toCents(105))
  })

  it('charges nothing when the repayment stays inside the allowance', () => {
    const schedule = schedulePart({
      ...annuity,
      repayments: [{ kind: 'once', amountCents: toCents(10_000), month: 6 }],
      charge: { freeAnnualPercent: 10, chargePercent: 1.5 },
    })
    expect(schedule.totalChargeCents).toBe(0)
  })

  it('reprices an annuity at the rate the Member entered for the expiry', () => {
    const schedule = schedulePart({
      ...annuity,
      fixedUntilMonth: 60,
      expiryRatePercent: 5.5,
    })
    expect(schedule.paymentByMonth[60]).toBeGreaterThan(
      schedule.paymentByMonth[59],
    )
    expect(schedule.paymentByMonth[59]).toBe(schedule.monthlyPaymentCents)
  })

  it('keeps the current rate when no expiry rate was entered', () => {
    const schedule = schedulePart({ ...annuity, fixedUntilMonth: 60 })
    expect(schedule.paymentByMonth[60]).toBe(schedule.paymentByMonth[59])
  })
})

describe('calculationTotals', () => {
  const parts: LoanPart[] = [
    annuity,
    {
      kind: 'linear',
      principalCents: toCents(95_000),
      annualRatePercent: 2.15,
      termMonths: 168,
    },
    {
      kind: 'interestOnly',
      principalCents: toCents(70_000),
      annualRatePercent: 4.4,
      termMonths: 108,
    },
  ]

  it('sums the parts rather than pricing one loan', () => {
    const totals = calculationTotals(parts)
    const separately = parts
      .map((part) => schedulePart(part).monthlyPaymentCents)
      .reduce((sum, cents) => sum + cents, 0)
    expect(totals.monthlyCents).toBe(separately)
    expect(totals.outstandingCents).toBe(toCents(345_000))
    expect(totals.lastPayoffMonth).toBe(360)
  })

  it('answers with nothing for a calculation with no parts', () => {
    const totals = calculationTotals([])
    expect(totals.monthlyCents).toBe(0)
    expect(totals.lastPayoffMonth).toBe(0)
    expect(mortgageSteps([])).toEqual([])
  })
})

describe('mortgageSteps', () => {
  it('opens on today and steps when a fix ends', () => {
    const steps = mortgageSteps([
      { ...annuity, fixedUntilMonth: 60, expiryRatePercent: 5.5 },
    ])
    expect(steps[0].month).toBe(1)
    expect(steps[0].deltaCents).toBe(0)
    const refix = steps.find((step) => step.month === 61)
    expect(refix).toBeDefined()
    expect(refix?.deltaCents).toBeGreaterThan(0)
    expect(refix?.changes).toEqual([{ partIndex: 0, reason: 'refix' }])
  })

  it('steps down when a part is paid off', () => {
    const steps = mortgageSteps([
      annuity,
      {
        kind: 'interestOnly',
        principalCents: toCents(70_000),
        annualRatePercent: 4.4,
        termMonths: 108,
      },
    ])
    const payoff = steps.find((step) => step.month === 109)
    expect(payoff?.deltaCents).toBeLessThan(0)
    expect(payoff?.changes).toEqual([{ partIndex: 1, reason: 'paidOff' }])
  })

  it('reports a level mortgage as one step', () => {
    expect(mortgageSteps([annuity])).toHaveLength(1)
  })
})
