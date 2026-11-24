import { describe, expect, test } from 'vitest'
import {
  compareYears,
  energyChannelName,
  formatEnergyNumber,
  mirrorHeights,
  yearComparisonNote,
  yearPairHeights,
} from './energyPresent'
import {
  addEnergyMonths,
  amsterdamDayHours,
  amsterdamDayOf,
  amsterdamDayStart,
  checkEnergyContract,
  checkEnergyReading,
  type EnergyContractTerms,
  type EnergyDayUse,
  energyContractOn,
  energyCostPeriod,
  energyDayCost,
  energyDayFixedCost,
  energyMonthDays,
  energyNetMetering,
  energyReadingMoment,
  forecastMonthCents,
  netMeteringOn,
  netMeteringPossibleIn,
  parseMeterReading,
  spreadReadingsOverDays,
  ZERO_ENERGY_COST,
} from './energyUsage'
import { en } from './messages/en'

const HOUR = 3_600_000

describe('Amsterdam days', () => {
  test('start at local midnight, in winter and in summer time', () => {
    expect(amsterdamDayStart('2026-01-15')).toBe(Date.UTC(2026, 0, 14, 23))
    expect(amsterdamDayStart('2026-07-15')).toBe(Date.UTC(2026, 6, 14, 22))
  })

  test('the spring-forward day starts in winter time and lasts 23 hours', () => {
    // Sunday 29 March 2026: clocks go from 02:00 to 03:00.
    expect(amsterdamDayStart('2026-03-29')).toBe(Date.UTC(2026, 2, 28, 23))
    expect(amsterdamDayStart('2026-03-30')).toBe(Date.UTC(2026, 2, 29, 22))
    expect(amsterdamDayHours('2026-03-29')).toHaveLength(23)
  })

  test('the fall-back day starts in summer time and lasts 25 hours', () => {
    // Sunday 25 October 2026: clocks go from 03:00 back to 02:00.
    expect(amsterdamDayStart('2026-10-25')).toBe(Date.UTC(2026, 9, 24, 22))
    expect(amsterdamDayStart('2026-10-26')).toBe(Date.UTC(2026, 9, 25, 23))
    expect(amsterdamDayHours('2026-10-25')).toHaveLength(25)
    expect(amsterdamDayHours('2026-10-26')).toHaveLength(24)
  })

  test('a moment falls on its Amsterdam day', () => {
    expect(amsterdamDayOf(Date.UTC(2026, 10, 23, 22, 59))).toBe('2026-11-23')
    expect(amsterdamDayOf(Date.UTC(2026, 10, 23, 23, 0))).toBe('2026-11-24')
    expect(amsterdamDayOf(Date.UTC(2026, 6, 14, 22, 0))).toBe('2026-07-15')
  })

  test('months', () => {
    expect(energyMonthDays('2026-02')).toHaveLength(28)
    expect(energyMonthDays('2028-02').at(-1)).toBe('2028-02-29')
    expect(addEnergyMonths('2026-01', -1)).toBe('2025-12')
    expect(addEnergyMonths('2026-11', 14)).toBe('2028-01')
  })
})

describe('spreadReadingsOverDays', () => {
  const noonOn = (day: string) => amsterdamDayStart(day) + 12 * HOUR

  test('spreads a stretch in proportion to the time each day covers', () => {
    const readings = [
      { at: noonOn('2026-11-11'), value: 1100 },
      { at: noonOn('2026-11-01'), value: 1000 },
    ]
    const days = [
      '2026-10-31',
      ...Array.from({ length: 12 }, (_, index) =>
        `2026-11-${String(index + 1).padStart(2, '0')}`,
      ),
    ]
    const spread = spreadReadingsOverDays(readings, days)
    expect(spread[0]).toBeNull() // 31 Oct: before the first reading
    expect(spread[1]).toBeCloseTo(5) // 1 Nov: from noon
    for (let index = 2; index <= 10; index++) {
      expect(spread[index]).toBeCloseTo(10) // 2–10 Nov
    }
    expect(spread[11]).toBeCloseTo(5) // 11 Nov: until noon
    expect(spread[12]).toBeNull() // 12 Nov: after the last reading
  })

  test('a single reading spreads nothing', () => {
    expect(
      spreadReadingsOverDays([{ at: noonOn('2026-11-01'), value: 5 }], [
        '2026-11-01',
      ]),
    ).toEqual([null])
  })

  test('a reading lower than the one before (replaced meter) never spreads a negative amount', () => {
    const readings = [
      { at: noonOn('2026-11-01'), value: 1000 },
      { at: noonOn('2026-11-11'), value: 50 },
      { at: noonOn('2026-11-13'), value: 70 },
    ]
    const spread = spreadReadingsOverDays(readings, [
      '2026-11-05',
      '2026-11-11',
      '2026-11-12',
    ])
    expect(spread[0]).toBeNull()
    expect(spread[1]).toBeCloseTo(5)
    expect(spread[2]).toBeCloseTo(10)
  })
})

describe('checkEnergyReading', () => {
  test('accepts a reading between its neighbours, or equal to one', () => {
    expect(checkEnergyReading(110, { previous: 100, next: 120 })).toBeNull()
    expect(checkEnergyReading(100, { previous: 100 })).toBeNull()
    expect(checkEnergyReading(0)).toBeNull()
  })

  test('refuses lower than the previous, higher than the next, negative, NaN', () => {
    expect(checkEnergyReading(99, { previous: 100 })).toBe('lowerThanPrevious')
    expect(checkEnergyReading(121, { previous: 100, next: 120 })).toBe(
      'higherThanNext',
    )
    expect(checkEnergyReading(-1)).toBe('negative')
    expect(checkEnergyReading(Number.NaN)).toBe('notANumber')
    expect(checkEnergyReading(null)).toBe('notANumber')
    expect(checkEnergyReading(Number.POSITIVE_INFINITY)).toBe('notANumber')
  })
})

describe('parseMeterReading', () => {
  test('reads either decimal mark, and the last of two as the decimal', () => {
    expect(parseMeterReading('24219,8')).toBe(24219.8)
    expect(parseMeterReading('24219.8')).toBe(24219.8)
    expect(parseMeterReading('24.219,8')).toBe(24219.8)
    expect(parseMeterReading('24,219.8')).toBe(24219.8)
    expect(parseMeterReading(' 24 219,8 ')).toBe(24219.8)
  })

  test('a blank or a word is no reading', () => {
    expect(parseMeterReading('')).toBeNull()
    expect(parseMeterReading('   ')).toBeNull()
    expect(parseMeterReading('abc')).toBeNull()
  })
})

describe('energyReadingMoment', () => {
  const now = Date.UTC(2026, 10, 23, 9, 30) // 10:30 in Amsterdam

  test('today is now, a past day noon that day, a future day none', () => {
    expect(energyReadingMoment('2026-11-23', now)).toBe(now)
    expect(energyReadingMoment('2026-11-20', now)).toBe(
      Date.UTC(2026, 10, 20, 11),
    )
    expect(energyReadingMoment('2026-11-24', now)).toBeNull()
    expect(energyReadingMoment('not a day', now)).toBeNull()
  })

  test('today is the Amsterdam day, not the UTC one', () => {
    const lateEvening = Date.UTC(2026, 10, 23, 23, 30) // 00:30 on the 24th
    expect(energyReadingMoment('2026-11-24', lateEvening)).toBe(lateEvening)
  })
})

const FIXED: EnergyContractTerms = {
  validFrom: '2026-01-01',
  kind: 'fixed',
  supplierName: 'Eneco',
  importMarkupEurPerKwh: 0,
  exportFeeEurPerKwh: 0,
  energyTaxEurPerKwh: 0.1088,
  gasTaxEurPerM3: 0.6,
  fixedTariffs: { t1: 0.27, t2: 0.29, export: 0.06, gas: 1.1 },
  vatPercent: 21,
  monthlyFixedCents: 2805,
  yearlyTaxCreditCents: 52495,
  netMetering: true,
}

const DYNAMIC: EnergyContractTerms = {
  validFrom: '2026-01-01',
  kind: 'dynamic',
  importMarkupEurPerKwh: 0.02,
  exportFeeEurPerKwh: -0.01,
  energyTaxEurPerKwh: 0.1,
  gasMarkupEurPerM3: 0.05,
  gasTaxEurPerM3: 0.6,
  vatPercent: 21,
  monthlyFixedCents: 0,
  netMetering: false,
}

function use(overrides: Partial<EnergyDayUse> = {}): EnergyDayUse {
  return {
    day: '2026-11-10',
    importKwh: { t1: 4, t2: 6, single: 0 },
    exportKwh: { t1: 2, t2: 1, single: 0 },
    gasM3: 2,
    marketEurPerKwh: null,
    gasMarketEurPerM3: null,
    ...overrides,
  }
}

describe('energyContractOn', () => {
  test('the latest contract that started on or before the day', () => {
    const contracts = [
      { validFrom: '2026-06-01', id: 'b' },
      { validFrom: '2026-01-01', id: 'a' },
    ]
    expect(energyContractOn(contracts, '2025-12-31')).toBeUndefined()
    expect(energyContractOn(contracts, '2026-01-01')?.id).toBe('a')
    expect(energyContractOn(contracts, '2026-05-31')?.id).toBe('a')
    expect(energyContractOn(contracts, '2026-06-01')?.id).toBe('b')
  })
})

describe('checkEnergyContract', () => {
  test('a valid contract passes', () => {
    expect(checkEnergyContract(FIXED)).toBeNull()
    expect(checkEnergyContract(DYNAMIC)).toBeNull()
  })

  test('refuses a bad date, a fixed contract without tariffs, bad amounts', () => {
    expect(checkEnergyContract({ ...FIXED, validFrom: '2026-13-01' })).toBe(
      'invalidDate',
    )
    expect(checkEnergyContract({ ...FIXED, fixedTariffs: undefined })).toBe(
      'needsTariffs',
    )
    expect(checkEnergyContract({ ...FIXED, energyTaxEurPerKwh: -0.1 })).toBe(
      'invalidAmount',
    )
    expect(checkEnergyContract({ ...FIXED, vatPercent: 101 })).toBe(
      'invalidAmount',
    )
    expect(
      checkEnergyContract({
        ...FIXED,
        fixedTariffs: { t1: Number.NaN, t2: 0.29, export: 0.06, gas: 1.1 },
      }),
    ).toBe('invalidAmount')
    // A negative export fee is a cost, which is allowed.
    expect(checkEnergyContract({ ...DYNAMIC, exportFeeEurPerKwh: -0.1 })).toBeNull()
  })
})

describe('energyDayCost, fixed contract', () => {
  /*
   * 10 November 2026 (30 days in the month, 365 in the year), VAT 21%:
   *   import  4 kWh T1 × (0.27 + 0.1088) = 1.5152
   *           6 kWh T2 × (0.29 + 0.1088) = 2.3928
   *           3.9080 × 1.21 = 4.72868 €              →  473 ct
   *   export  3 kWh × 0.06 = 0.18 €                   →  −18 ct
   *   gas     2 m³ × (1.10 + 0.60) × 1.21 = 4.114 €   →  411 ct
   *   fixed   2805 / 30 × 1.21 = 113.135              →  113 ct
   *   credit  52495 / 365 × 1.21 = 174.02...          → −174 ct
   *   total   473 − 18 + 411 + 113 − 174 = 805
   */
  test('each part to the cent', () => {
    expect(energyDayCost(use(), FIXED)).toEqual({
      importCents: 473,
      exportCents: -18,
      gasCents: 411,
      fixedCents: 113,
      creditCents: -174,
      totalCents: 805,
    })
  })

  test('a day with nothing exported or credited is zero, not minus zero', () => {
    const cost = energyDayCost(
      use({ exportKwh: { t1: 0, t2: 0, single: 0 } }),
      { ...FIXED, yearlyTaxCreditCents: undefined })
    expect(Object.is(cost?.exportCents, 0)).toBe(true)
    expect(Object.is(cost?.creditCents, 0)).toBe(true)
  })
})

describe('energyDayCost, dynamic contract', () => {
  test('is null without the prices it needs, never a guess', () => {
    expect(energyDayCost(use(), DYNAMIC)).toBeNull()
    // Electricity priced, gas not.
    expect(
      energyDayCost(use({ marketEurPerKwh: 0.1 }), DYNAMIC),
    ).toBeNull()
  })

  test('prices hour by hour when hours are given', () => {
    /*
     * hour 1: 1 kWh × (0.10 + 0.02 + 0.10) × 1.21 = 0.2662
     * hour 2: 2 kWh × (0.30 + 0.02 + 0.10) × 1.21 = 1.0164 → import 128 ct
     * export: 1 kWh × (0.30 − 0.01) = 0.29 € excl. VAT     → −29 ct
     * an hour without usage needs no price.
     */
    const cost = energyDayCost(
      use({
        importKwh: { t1: 0, t2: 0, single: 3 },
        exportKwh: { t1: 0, t2: 0, single: 1 },
        gasM3: null,
        hours: [
          { importKwh: 1, exportKwh: 0, marketEurPerKwh: 0.1 },
          { importKwh: 2, exportKwh: 1, marketEurPerKwh: 0.3 },
          { importKwh: 0, exportKwh: 0, marketEurPerKwh: null },
        ],
      }),
      DYNAMIC)
    expect(cost).toMatchObject({ importCents: 128, exportCents: -29 })
    expect(cost?.totalCents).toBe(99)
  })

  test('an hour with usage but no price makes the day unpriced', () => {
    expect(
      energyDayCost(
        use({
          gasM3: null,
          hours: [{ importKwh: 1, exportKwh: 0, marketEurPerKwh: null }],
        }),
        DYNAMIC),
    ).toBeNull()
  })

  test('gas at the market price plus markup and tax', () => {
    // 2 m³ × (0.50 + 0.05 + 0.60) × 1.21 = 2.783 → 278 ct
    const cost = energyDayCost(
      use({ marketEurPerKwh: 0.1, gasMarketEurPerM3: 0.5 }),
      DYNAMIC)
    expect(cost?.gasCents).toBe(278)
  })
})

describe('energyNetMetering, over a month', () => {
  const cost = (importCents: number, exportCents: number) => ({
    ...ZERO_ENERGY_COST,
    importCents,
    exportCents,
    totalCents: importCents + exportCents,
  })

  test('a sunny day’s export offsets a grey day’s import at the import price', () => {
    // 10 kWh bought at 40 ct; 10 kWh sold at 6 ct: all 10 netted, worth 34 ct more each.
    const [grey, sunny] = energyNetMetering([
      { importKwh: 10, exportKwh: 0, cost: cost(400, 0) },
      { importKwh: 0, exportKwh: 10, cost: cost(0, -60) },
    ])
    expect(grey).toMatchObject({ importCents: 400, exportCents: 0, totalCents: 400 })
    expect(sunny).toMatchObject({ exportCents: -400, totalCents: -400 })
  })

  test('only up to the month’s import; the rest earns the export price', () => {
    const [, sunny] = energyNetMetering([
      { importKwh: 10, exportKwh: 0, cost: cost(400, 0) },
      { importKwh: 0, exportKwh: 15, cost: cost(0, -90) },
    ])
    // 10 × 40 + 5 × 6
    expect(sunny?.exportCents).toBe(-430)
  })

  test('the credit is shared by export and adds up to the cent', () => {
    const days = energyNetMetering([
      { importKwh: 1, exportKwh: 1, cost: cost(100, 0) },
      { importKwh: 0, exportKwh: 1, cost: cost(0, 0) },
      { importKwh: 0, exportKwh: 1, cost: cost(0, 0) },
    ])
    expect(days.map((day) => day.exportCents)).toEqual([-33, -34, -33])
  })

  test('without import or export nothing changes', () => {
    const days = [{ importKwh: 0, exportKwh: 4, cost: cost(0, -24) }]
    expect(energyNetMetering(days)).toEqual([days[0]?.cost])
  })
})

describe('net metering ends on 1 January 2027', () => {
  test('a contract nets until the end of 2026, never after', () => {
    expect(netMeteringOn(FIXED, '2026-12-31')).toBe(true)
    expect(netMeteringOn(FIXED, '2027-01-01')).toBe(false)
    expect(netMeteringOn({ netMetering: false }, '2026-06-01')).toBe(false)
  })

  test('the choice is offered for months before 2027 only', () => {
    expect(netMeteringPossibleIn('2026-12')).toBe(true)
    expect(netMeteringPossibleIn('2027-01')).toBe(false)
  })
})

describe('energyNetMetering with export above import', () => {
  test('never adds cost: each day keeps what it costs without', () => {
    const days = [
      {
        importKwh: 10,
        exportKwh: 0,
        cost: { ...ZERO_ENERGY_COST, importCents: 100, totalCents: 100 },
      },
      {
        importKwh: 0,
        exportKwh: 10,
        cost: { ...ZERO_ENERGY_COST, exportCents: -300, totalCents: -300 },
      },
    ]
    expect(energyNetMetering(days)).toEqual(days.map((day) => day.cost))
  })
})

describe('energyDayFixedCost', () => {
  const terms = { monthlyFixedCents: 3000, yearlyTaxCreditCents: 36500, vatPercent: 0 }
  test('is the month’s share of the fee and the year’s of the credit', () => {
    expect(energyDayFixedCost('2026-11-05', terms)).toEqual({
      ...ZERO_ENERGY_COST,
      fixedCents: 100,
      creditCents: -100,
      totalCents: 0,
    })
  })
  test('is nothing under a contract with neither', () => {
    expect(
      energyDayFixedCost('2026-11-05', { monthlyFixedCents: 0, vatPercent: 21 }),
    ).toBeNull()
  })
})

describe('forecastMonthCents', () => {
  test('extends the days so far to the whole month', () => {
    const cost = { ...ZERO_ENERGY_COST, importCents: 1000, totalCents: 1000 }
    expect(forecastMonthCents(cost, 10, 10, '2026-11')).toBe(3000)
    expect(forecastMonthCents(cost, 0, 10, '2026-11')).toBeNull()
  })

  test('extends fixed costs from the days they ran, not the days with usage', () => {
    const cost = {
      ...ZERO_ENERGY_COST,
      importCents: 1000,
      fixedCents: 2000,
      creditCents: -1000,
      totalCents: 2000,
    }
    // 10 days of usage, 20 days of fixed costs: 1000 × 3 + 1000 × 1.5.
    expect(forecastMonthCents(cost, 10, 20, '2026-11')).toBe(4500)
  })
})

describe('presenting', () => {
  test('numbers in the reader’s language', () => {
    expect(formatEnergyNumber(24219.8, 'nl-NL')).toBe('24.219,8')
    expect(formatEnergyNumber(24219.8, 'en-GB')).toBe('24,219.8')
  })

  test('a split meter’s channel names its tariff', () => {
    const words = en.energy
    expect(energyChannelName({ kind: 'gridImport', tariff: 't1' }, words)).toBe(
      words.channels.gridImportT1,
    )
    expect(energyChannelName({ kind: 'gas' }, words)).toBe(words.channels.gas)
  })

  test('mirrored bars share one scale; a past slot without figures is empty', () => {
    expect(
      mirrorHeights([
        { key: 'a', up: 4, down: 2, future: false },
        { key: 'b', up: null, down: null, future: false },
        { key: 'c', up: null, down: null, future: true },
      ]),
    ).toEqual([
      { key: 'a', up: 1, down: 0.5, future: false, empty: false },
      { key: 'b', up: 0, down: 0, future: false, empty: true },
      { key: 'c', up: 0, down: 0, future: true, empty: false },
    ])
  })

  test('year pairs share one scale and mark the running month', () => {
    const pairs = yearPairHeights([100, 50], [200, null], 1)
    expect(pairs).toHaveLength(12)
    expect(pairs[0]).toEqual({
      previous: 0.5,
      current: 1,
      running: false,
      hasCurrent: true,
    })
    expect(pairs[1]).toMatchObject({ running: true, hasCurrent: false })
  })

  test('comparing years leaves out the running month and those after it', () => {
    const previous = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
    const current = [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 10, null]
    const comparison = compareYears(previous, current, 10)
    expect(comparison).toEqual({
      fromIndex: 0,
      toIndex: 9,
      current: 900,
      previous: 1000,
      difference: -100,
      percent: -10,
    })
    expect(yearComparisonNote(comparison?.percent ?? null, 2025, en.energy)).toBe(
      '10% less than the same months in 2025.',
    )
  })

  test('comparing years skips months without figures on either side', () => {
    const previous = [null, 100, 100, ...Array(9).fill(null)]
    const current = [50, 120, null, ...Array(9).fill(null)]
    expect(compareYears(previous, current, null)).toMatchObject({
      fromIndex: 1,
      toIndex: 1,
      percent: 20,
    })
    expect(compareYears([], [], 0)).toBeNull()
  })
})

describe('energyCostPeriod', () => {
  const priced = (day: string) => ({ day, cost: ZERO_ENERGY_COST })
  const unpriced = (day: string) => ({ day, cost: null })
  test('runs from the first to the last day that carries a cost', () => {
    expect(
      energyCostPeriod([
        priced('2026-11-01'),
        priced('2026-11-02'),
        priced('2026-11-03'),
        unpriced('2026-11-04'),
      ]),
    ).toEqual({ from: '2026-11-01', to: '2026-11-03' })
  })
  test('is nothing when no day carries a cost', () => {
    expect(energyCostPeriod([unpriced('2026-11-01')])).toBeNull()
    expect(energyCostPeriod([])).toBeNull()
  })
})
