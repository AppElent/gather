import { describe, expect, it } from 'vitest'

import { homeBuyingCosts } from '../buyingCosts'
import { addMonths, monthsUntil, parseIsoDate, todayIso } from '../dates'
import { formatMoney, roundCents, splitEvenly, toCents } from '../money'
import { changeSince, netWorthTotals } from '../netWorth'
import {
  holdingPosition,
  isStale,
  portfolioTotals,
  STALE_AFTER_MS,
  type ValuedHolding,
} from '../portfolio'
import {
  monthlyCents,
  recurringTotals,
  shareOf,
  splitTotalsToHundred,
} from '../recurring'
import { savingsProgress } from '../savings'
import { customCoversTotal, splitEvent } from '../split'

describe('money', () => {
  it('rounds half away from zero, so a debt is never rounded to nothing', () => {
    expect(roundCents(0.5)).toBe(1)
    expect(roundCents(-0.5)).toBe(-1)
  })

  it('hands the remainder out rather than losing it', () => {
    const parts = splitEvenly(toCents(10), 3)
    expect(parts).toEqual([334, 333, 333])
    expect(parts.reduce((sum, cents) => sum + cents, 0)).toBe(toCents(10))
  })

  it('splits a negative total without inventing a cent', () => {
    const parts = splitEvenly(-1000, 3)
    expect(parts.reduce((sum, cents) => sum + cents, 0)).toBe(-1000)
  })

  it('formats in the reader language rather than the device one', () => {
    expect(formatMoney(123_456, 'EUR', 'nl')).toContain('1.234,56')
    expect(formatMoney(123_456, 'EUR', 'en')).toContain('1,234.56')
  })
})

describe('dates', () => {
  it('refuses something that is not a date', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('tomorrow')).toBeNull()
  })

  it('lands on a real day when a month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('counts a part month as a month to save in', () => {
    expect(monthsUntil('2026-08-25', '2028-02-01')).toBe(18)
    expect(monthsUntil('2026-08-01', '2026-09-01')).toBe(1)
    expect(monthsUntil('2026-08-25', '2026-01-01')).toBe(0)
  })

  it('writes today the way everything else stores a date', () => {
    expect(todayIso(new Date(2026, 7, 5))).toBe('2026-08-05')
  })
})

describe('recurring costs', () => {
  it('turns every frequency into the same monthly figure', () => {
    expect(monthlyCents({ amountCents: 62_400, frequency: 'yearly' })).toBe(
      5200,
    )
    expect(monthlyCents({ amountCents: 3200, frequency: 'quarterly' })).toBe(
      1067,
    )
    expect(monthlyCents({ amountCents: 1000, frequency: 'monthly' })).toBe(1000)
  })

  it('only accepts a ratio that adds up to a hundred', () => {
    expect(
      splitTotalsToHundred([
        { memberId: 'a', percent: 55 },
        { memberId: 'b', percent: 45 },
      ]),
    ).toBe(true)
    expect(splitTotalsToHundred([{ memberId: 'a', percent: 90 }])).toBe(false)
    expect(splitTotalsToHundred([])).toBe(false)
  })

  it('divides a cost so the shares add back up to it', () => {
    const shares = shareOf(72_000, [
      { memberId: 'a', percent: 55 },
      { memberId: 'b', percent: 45 },
    ])
    expect(shares.get('a')).toBe(39_600)
    expect(shares.get('b')).toBe(32_400)
    expect((shares.get('a') ?? 0) + (shares.get('b') ?? 0)).toBe(72_000)
  })

  it('totals the household and each Member, grouped by category', () => {
    const totals = recurringTotals([
      {
        amountCents: 72_000,
        frequency: 'monthly',
        category: 'housing',
        split: [
          { memberId: 'a', percent: 55 },
          { memberId: 'b', percent: 45 },
        ],
      },
      {
        amountCents: 62_400,
        frequency: 'yearly',
        category: 'insurance',
        split: [{ memberId: 'a', percent: 100 }],
      },
    ])
    expect(totals.monthlyCents).toBe(77_200)
    expect(totals.annualCents).toBe(926_400)
    expect(totals.perMemberMonthlyCents.get('a')).toBe(44_800)
    expect(totals.byCategory).toEqual([
      { category: 'housing', monthlyCents: 72_000 },
      { category: 'insurance', monthlyCents: 5200 },
    ])
  })
})

describe('shared costs', () => {
  const payments = [
    { memberId: 'rae', amountCents: 64_000 },
    { memberId: 'sam', amountCents: 28_500 },
    { memberId: 'joos', amountCents: 12_500 },
  ]

  it('settles one event with the fewest transfers', () => {
    const result = splitEvent({
      payments,
      participantIds: ['rae', 'sam', 'joos'],
      mode: 'equal',
    })
    expect(result.totalCents).toBe(105_000)
    expect(result.owedCents.get('rae')).toBe(35_000)
    expect(result.transfers).toEqual([
      { fromMemberId: 'joos', toMemberId: 'rae', amountCents: 22_500 },
      { fromMemberId: 'sam', toMemberId: 'rae', amountCents: 6500 },
    ])
  })

  it('balances to zero, so nothing is invented or lost', () => {
    const result = splitEvent({
      payments,
      participantIds: ['rae', 'sam', 'joos', 'wil'],
      mode: 'equal',
    })
    const sum = [...result.balanceCents.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(0)
  })

  it('lets somebody pay who is not splitting it', () => {
    const result = splitEvent({
      payments: [{ memberId: 'rae', amountCents: 10_000 }],
      participantIds: ['sam'],
      mode: 'equal',
    })
    expect(result.transfers).toEqual([
      { fromMemberId: 'sam', toMemberId: 'rae', amountCents: 10_000 },
    ])
  })

  it('refuses a custom allocation that does not hand out what was paid', () => {
    const input = {
      payments,
      participantIds: ['rae', 'sam', 'joos'],
      mode: 'custom' as const,
      customCents: { rae: 50_000, sam: 30_000, joos: 20_000 },
    }
    expect(customCoversTotal(input)).toBe(false)
    expect(
      customCoversTotal({
        ...input,
        customCents: { rae: 50_000, sam: 30_000, joos: 25_000 },
      }),
    ).toBe(true)
  })
})

describe('savings goals', () => {
  const goal = {
    targetCents: toCents(15_000),
    savedCents: toCents(6400),
    targetDate: '2028-03-01',
    monthlyCents: toCents(300),
  }

  it('says what a month has to be, and where the current pace lands', () => {
    const progress = savingsProgress(goal, '2026-08-25')
    expect(progress.remainingCents).toBe(toCents(8600))
    expect(progress.monthsRemaining).toBe(19)
    expect(progress.requiredMonthlyCents).toBe(45_263)
    expect(progress.expectedDate).toBe('2029-01-25')
    expect(progress.behind).toBe(true)
  })

  it('needs the whole remainder when the date has arrived', () => {
    const progress = savingsProgress(
      { ...goal, targetDate: '2026-08-01' },
      '2026-08-25',
    )
    expect(progress.monthsRemaining).toBe(0)
    expect(progress.requiredMonthlyCents).toBe(toCents(8600))
  })

  it('stops at reached rather than running past it', () => {
    const progress = savingsProgress(
      { ...goal, savedCents: toCents(16_000) },
      '2026-08-25',
    )
    expect(progress.reached).toBe(true)
    expect(progress.fraction).toBe(1)
    expect(progress.requiredMonthlyCents).toBeNull()
    expect(progress.behind).toBe(false)
  })

  it('has no expected date without a pace', () => {
    const progress = savingsProgress(
      { ...goal, monthlyCents: undefined },
      '2026-08-25',
    )
    expect(progress.expectedDate).toBeNull()
    expect(progress.behind).toBe(false)
  })
})

describe('home-buying costs', () => {
  const input = {
    purchasePriceCents: toCents(425_000),
    ownMoneyCents: toCents(45_000),
    mortgageCents: toCents(425_000),
    mortgageRatePercent: 3.9,
    mortgageTermMonths: 360,
    transferTaxBand: 'ownHome' as const,
    transferTaxPercent: 2,
    lines: {
      notary: toCents(1650),
      valuation: toCents(650),
      mortgageAdvice: toCents(2700),
      structuralSurvey: toCents(450),
      buyingAgent: toCents(3900),
    },
  }

  it('adds the tax and the fees the Member entered', () => {
    const result = homeBuyingCosts(input)
    expect(result.transferTaxCents).toBe(toCents(8500))
    expect(result.cashNeededCents).toBe(toCents(17_850))
    expect(result.shortCents).toBe(toCents(-27_150))
    expect(result.estimatedMonthlyCents).toBe(200_459)
  })

  it('counts the part of the price the mortgage does not cover', () => {
    const result = homeBuyingCosts({
      ...input,
      mortgageCents: toCents(380_000),
    })
    expect(result.shortfallOnPriceCents).toBe(toCents(45_000))
    expect(result.cashNeededCents).toBe(toCents(62_850))
    expect(result.shortCents).toBe(toCents(17_850))
  })

  it('charges NHG only when the household says it is using it', () => {
    expect(homeBuyingCosts(input).nhgCents).toBe(0)
    expect(homeBuyingCosts({ ...input, nhgPercent: 0.4 }).nhgCents).toBe(
      toCents(1700),
    )
  })
})

describe('portfolio', () => {
  const opening = { date: '2026-01-01', units: 12, averageCostCents: 61_240 }

  it('keeps average cost across a buy and realises on a sale', () => {
    const position = holdingPosition(opening, [
      {
        kind: 'buy',
        date: '2026-02-14',
        units: 3,
        pricePerUnitCents: 64_000,
        feeCents: 250,
      },
      { kind: 'sell', date: '2026-04-22', units: 3, pricePerUnitCents: 66_800 },
    ])
    expect(position.units).toBe(12)
    expect(position.averageCostCents).toBe(61_809)
    expect(position.realizedCents).toBe(14_974)
    expect(position.feesCents).toBe(250)
  })

  it('pays a dividend on the units held at the time', () => {
    const position = holdingPosition(opening, [
      { kind: 'dividend', date: '2026-03-03', perUnitCents: 155 },
    ])
    expect(position.dividendsCents).toBe(1860)
    expect(position.averageCostCents).toBe(61_240)
  })

  it('applies transactions in date order, not in entry order', () => {
    const late = holdingPosition(opening, [
      { kind: 'dividend', date: '2026-06-01', perUnitCents: 100 },
      { kind: 'buy', date: '2026-02-01', units: 12, pricePerUnitCents: 60_000 },
    ])
    expect(late.dividendsCents).toBe(2400)
  })

  it('takes a Member-entered adjustment as the position, and never guesses one', () => {
    const position = holdingPosition(opening, [
      {
        kind: 'adjustment',
        date: '2026-06-02',
        units: 36,
        pricePerUnitCents: 20_413,
      },
    ])
    expect(position.units).toBe(36)
    expect(position.averageCostCents).toBe(20_413)
  })

  it('marks a valuation stale rather than blanking it', () => {
    const now = Date.UTC(2026, 7, 25, 12)
    expect(isStale(now - 1000, now)).toBe(false)
    expect(isStale(now - STALE_AFTER_MS - 1000, now)).toBe(true)
    expect(isStale(null, now)).toBe(true)
  })

  it('converts a foreign holding into the home currency and keeps the older stamp', () => {
    const now = Date.UTC(2026, 7, 25, 12)
    const holdings: ValuedHolding[] = [
      {
        id: 'asml',
        symbol: 'ASML',
        currency: 'EUR',
        position: holdingPosition(opening, []),
        quote: { pricePerUnitCents: 65_100, asOf: now - 60_000 },
        fx: null,
      },
      {
        id: 'aapl',
        symbol: 'AAPL',
        currency: 'USD',
        position: holdingPosition(
          { date: '2026-01-01', units: 9, averageCostCents: 25_000 },
          [],
        ),
        quote: { pricePerUnitCents: 27_310, asOf: now - 120_000 },
        fx: { rate: 0.873, asOf: now - 3_600_000 },
      },
    ]
    const totals = portfolioTotals(holdings, now)
    expect(totals.totalValueCents).toBe(781_200 + 214_575)
    expect(totals.stale).toBe(false)
    expect(totals.asOf).toBe(now - 3_600_000)
    expect(totals.unrealizedPercent).toBeGreaterThan(0)
  })

  it('reports stale when any figure behind the total is old', () => {
    const now = Date.UTC(2026, 7, 25, 12)
    const totals = portfolioTotals(
      [
        {
          id: 'asml',
          symbol: 'ASML',
          currency: 'EUR',
          position: holdingPosition(opening, []),
          quote: { pricePerUnitCents: 65_100, asOf: now - STALE_AFTER_MS * 2 },
          fx: null,
        },
      ],
      now,
    )
    expect(totals.stale).toBe(true)
    expect(totals.totalValueCents).toBe(781_200)
  })

  it('has no percentage to report when nothing is invested', () => {
    expect(portfolioTotals([], Date.now()).unrealizedPercent).toBeNull()
  })
})

describe('net worth', () => {
  const rows = [
    {
      kind: 'asset' as const,
      source: 'house' as const,
      label: 'Kerkstraat 14',
      amountCents: toCents(452_000),
    },
    {
      kind: 'asset' as const,
      source: 'portfolio' as const,
      label: 'Portfolio',
      amountCents: toCents(48_210),
    },
    {
      kind: 'asset' as const,
      source: 'manual' as const,
      label: 'Savings',
      amountCents: toCents(21_400),
    },
    {
      kind: 'liability' as const,
      source: 'mortgage' as const,
      label: 'Mortgage',
      amountCents: toCents(198_400),
    },
    {
      kind: 'liability' as const,
      source: 'manual' as const,
      label: 'Student loan',
      amountCents: toCents(6550),
    },
  ]

  it('subtracts what is owed from what is owned', () => {
    const totals = netWorthTotals(rows)
    expect(totals.assetsCents).toBe(toCents(521_610))
    expect(totals.liabilitiesCents).toBe(toCents(204_950))
    expect(totals.netCents).toBe(toCents(316_660))
  })

  it('has no change to report before the first snapshot', () => {
    expect(changeSince(toCents(316_660), null)).toBeNull()
    expect(changeSince(toCents(316_660), toCents(312_480))).toBe(toCents(4180))
  })
})
