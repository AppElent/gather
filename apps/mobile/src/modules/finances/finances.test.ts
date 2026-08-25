import { describe, expect, it } from 'vitest'

import { termWords, toLoanPart, toLoanParts } from './loanParts'
import { netWorthRows } from './netWorthRows'
import { portfolioTotalsFor } from './portfolioTotals'
import { valuedHoldings } from './portfolioView'

const TODAY = '2026-08-25'

describe('a stored loan part becomes one the seam can price', () => {
  const stored = {
    kind: 'annuity' as const,
    principalCents: 18_000_000,
    annualRatePercent: 3.9,
    termMonths: 360,
    fixedUntil: '2031-06-01',
    expiryRatePercent: 5,
  }

  it('counts the months to a fix from today rather than storing them', () => {
    expect(toLoanPart(stored, TODAY).fixedUntilMonth).toBe(58)
  })

  it('treats a fix that has already run out as no fix at all', () => {
    expect(
      toLoanPart({ ...stored, fixedUntil: '2020-01-01' }, TODAY)
        .fixedUntilMonth,
    ).toBe(0)
  })

  it('leaves a variable part with no expiry month', () => {
    expect(
      toLoanPart({ ...stored, fixedUntil: undefined }, TODAY).fixedUntilMonth,
    ).toBeUndefined()
  })

  it('keeps a repayment that started before today running', () => {
    const part = toLoanPart(
      {
        ...stored,
        repayments: [
          { kind: 'monthly', amountCents: 20_000, date: '2025-09-01' },
        ],
      },
      TODAY,
    )
    expect(part.repayments?.[0].month).toBe(1)
  })

  it('dates a repayment still to come from today', () => {
    const part = toLoanPart(
      {
        ...stored,
        repayments: [
          { kind: 'once', amountCents: 1_000_000, date: '2027-08-25' },
        ],
      },
      TODAY,
    )
    expect(part.repayments?.[0].month).toBe(13)
  })

  it('converts a whole calculation at once', () => {
    expect(toLoanParts([stored, stored], TODAY)).toHaveLength(2)
  })
})

describe('a term is said the way a household says it', () => {
  const words = { years: '{years} years', months: '{months} months' }

  it('rounds to years when it divides', () => {
    expect(termWords(360, words)).toBe('30 years')
  })

  it('stays in months when it does not', () => {
    expect(termWords(18, words)).toBe('18 months')
    expect(termWords(14, words)).toBe('14 months')
  })
})

describe('net worth derives three kinds of row', () => {
  const labels = { portfolio: 'Portfolio', mortgage: 'Mortgage' }

  it('takes the house, its mortgage and the portfolio from elsewhere', () => {
    const rows = netWorthRows({
      houses: [
        {
          name: 'Kerkstraat 14',
          valueCents: 45_200_000,
          valueAsOf: '2026-07-01',
          mortgageOutstandingCents: 19_840_000,
        },
      ],
      portfolioCents: 4_821_000,
      portfolioAsOf: TODAY,
      manual: [
        { kind: 'asset', label: 'Savings', amountCents: 2_140_000 },
        { kind: 'liability', label: 'Student loan', amountCents: 655_000 },
      ],
      labels,
    })

    expect(rows.map((row) => row.source)).toEqual([
      'house',
      'portfolio',
      'manual',
      'mortgage',
      'manual',
    ])
    expect(rows[0].asOf).toBe('2026-07-01')
  })

  it('leaves out a house nobody has valued, rather than counting it as nothing', () => {
    const rows = netWorthRows({
      houses: [{ name: 'Kerkstraat 14' }],
      portfolioCents: null,
      manual: [],
      labels,
    })
    expect(rows).toEqual([])
  })

  it('has no Portfolio row when the Group holds nothing', () => {
    const rows = netWorthRows({
      houses: [],
      portfolioCents: null,
      manual: [{ kind: 'asset', label: 'Savings', amountCents: 100 }],
      labels,
    })
    expect(rows.map((row) => row.source)).toEqual(['manual'])
  })
})

describe('a stored holding becomes one the seam can value', () => {
  const now = Date.UTC(2026, 7, 25, 12)
  const holding = {
    _id: 'h1',
    symbol: 'ASML',
    name: 'ASML Holding NV',
    currency: 'EUR',
    openingDate: '2026-01-01',
    openingUnits: 12,
    openingAverageCostCents: 61_240,
    lastPriceCents: 65_100,
    lastPriceAt: now - 60_000,
    transactions: [],
  }

  it('has no quote at all when nobody has entered a price', () => {
    const [valued] = valuedHoldings(
      [{ ...holding, lastPriceCents: undefined, lastPriceAt: undefined }],
      'EUR',
      [],
    )
    expect(valued.quote).toBeNull()
  })

  it('needs no conversion in the Group home currency', () => {
    expect(valuedHoldings([holding], 'EUR', [])[0].fx).toBeNull()
  })

  it('is stale when its currency has no conversion entered', () => {
    const totals = portfolioTotalsFor(
      [{ ...holding, currency: 'USD' }],
      'EUR',
      [],
      now,
    )
    expect(totals.stale).toBe(true)
  })

  it('converts with the rate a Member entered', () => {
    const totals = portfolioTotalsFor(
      [{ ...holding, currency: 'USD' }],
      'EUR',
      [{ currency: 'USD', rate: 0.9, asOf: now - 1000 }],
      now,
    )
    expect(totals.stale).toBe(false)
    expect(totals.totalValueCents).toBe(Math.round(12 * 65_100 * 0.9))
  })
})
