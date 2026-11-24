import { describe, expect, test } from 'vitest'
import { amsterdamDayHours } from './energy'
import {
  type EnergyPriceDay,
  type EnergyPriceView,
  energyNegativeCards,
  energyPriceBuildUp,
  energyPriceChart,
  energyPriceFootnote,
  energyPriceNow,
  energyPriceProblem,
  energyPriceStateLine,
  energyTomorrowLine,
  formatEnergyPrice,
} from './energyPresent'
import { en } from './messages/en'
import { nl } from './messages/nl'

const TERMS = {
  supplierName: 'Zonneplan',
  importMarkupEurPerKwh: 0.02,
  energyTaxEurPerKwh: 0.1,
  vatPercent: 21,
}

function day(date: string, price: (hour: number) => number, over: Partial<EnergyPriceDay> = {}) {
  return {
    day: date,
    provider: 'energyzero' as const,
    basis: 'allIn' as const,
    terms: TERMS,
    exportFeeEurPerKwh: -0.01,
    hours: amsterdamDayHours(date).map((start, index) => ({
      start,
      price: price(index),
      market: price(index) / 1.21 - 0.12,
    })),
    ...over,
  }
}
function view(over: Partial<EnergyPriceView> = {}): EnergyPriceView {
  return {
    siteName: 'Thuis',
    canManage: true,
    provider: 'energyzero',
    hasKey: false,
    status: 'ok',
    lastError: null,
    lastFetchedAt: Date.parse('2026-11-20T12:35:00Z'),
    contract: null,
    today: day('2026-11-20', () => 0.3),
    tomorrow: day('2026-11-21', () => 0.3),
    ...over,
  }
}
const NOW = Date.parse('2026-11-20T18:55:00Z')

describe('amounts', () => {
  test('a price that rounds to nothing has no sign', () => {
    expect(formatEnergyPrice(-0.001, 'en')).toBe('€0.00')
    expect(formatEnergyPrice(0.1234, 'en', 3)).toBe('€0.123')
    expect(formatEnergyPrice(0.37, 'nl').replace(/\s/g, ' ')).toBe('€ 0,37')
  })
})

describe('the chart in words', () => {
  test('in Dutch, with the end of the day as 24:00', () => {
    const chart = energyPriceChart(
      day('2026-11-20', (hour) => (hour >= 21 ? 0.1 : hour === 18 ? 0.5 : 0.3)),
      NOW,
      nl.energy,
      'nl',
    )
    expect(chart?.sentence).toContain('21:00 tot 24:00')
    expect(chart?.sentence).toContain('30 cent')
    expect(chart?.bars.filter((bar) => bar.cheapest)).toHaveLength(3)
    expect(chart?.bars.filter((bar) => bar.marked)).toHaveLength(1)
    expect(chart?.bars.filter((bar) => bar.past)).toHaveLength(19)
  })

  test.each([
    ['2026-03-29', 23],
    ['2026-10-25', 25],
  ])('a day the clocks change (%s) has %d bars', (date, hours) => {
    const chart = energyPriceChart(day(date, () => 0.3), null, en.energy, 'en')
    expect(chart?.bars).toHaveLength(hours)
    expect(new Set(chart?.bars.map((bar) => bar.key)).size).toBe(hours)
  })
})

describe('the Now card', () => {
  test('no share of an average that is not above zero', () => {
    const shown = energyPriceNow(
      view({ today: day('2026-11-20', () => -0.05), tomorrow: null }),
      NOW,
      en.energy,
      'en',
    )
    expect(shown?.comparison).toBe('Average for today')
  })

  test('none without a price for this hour', () => {
    expect(energyPriceNow(view({ today: null }), NOW, en.energy, 'en')).toBeNull()
    expect(
      energyPriceNow(view(), Date.parse('2026-11-22T10:00:00Z'), en.energy, 'en'),
    ).toBeNull()
  })
})

describe('the build-up', () => {
  test('adds up, with no width for a negative market price', () => {
    const prices = day('2026-11-20', () => 0.1)
    const hour = prices.hours[0]
    if (!hour) throw new Error('expected an hour')
    const buildUp = energyPriceBuildUp(prices, hour, en.energy, 'en')
    expect(buildUp?.title).toBe('What makes up €0.10')
    expect(buildUp?.parts[0]?.share).toBe(0)
    expect(
      buildUp?.parts.reduce((total, part) => total + part.share, 0),
    ).toBeCloseTo(1)
    expect(energyPriceBuildUp({ ...prices, terms: null }, hour, en.energy, 'en')).toBeNull()
  })
})

describe('negative prices', () => {
  test('under net metering nothing is said about a cost', () => {
    const prices = day('2026-11-20', () => 0.3, { exportFeeEurPerKwh: null })
    const hours = prices.hours.map((hour, at) => (at === 13 ? { ...hour, market: -0.1 } : hour))
    expect(energyNegativeCards({ ...prices, hours }, en.energy, 'en')).toMatchObject([
      { title: 'The market price is negative from 13:00 to 14:00.' },
    ])
  })
})

describe('where prices come from', () => {
  test('the line under Home', () => {
    const prices = day('2026-11-20', () => 0.3)
    expect(energyPriceFootnote(prices, en.energy)).toContain('Zonneplan')
    expect(
      energyPriceFootnote({ ...prices, provider: 'tibber', terms: null }, en.energy),
    ).toContain('from Tibber')
    expect(
      energyPriceFootnote({ ...prices, basis: 'market', terms: null }, en.energy),
    ).toContain('excl. VAT')
  })

  test('tomorrow missing is a problem only once it is due', () => {
    const early = Date.parse('2026-11-20T09:00:00Z')
    expect(energyPriceProblem(view({ tomorrow: null }), early)).toBeNull()
    expect(energyPriceProblem(view({ tomorrow: null }), NOW)).toBe('late')
    expect(energyTomorrowLine(early, nl.energy)).toContain('13:30')
    expect(energyTomorrowLine(NOW, en.energy)).toBe('Tomorrow’s prices are not in yet.')
  })

  test('a key just saved is fetching, not failing', () => {
    const saved = view({ provider: 'tibber', hasKey: true, lastFetchedAt: null, today: null, tomorrow: null })
    expect(energyPriceStateLine(saved, NOW, en.energy, 'en')).toEqual({
      text: 'Tibber · fetching prices…',
      problem: false,
    })
  })

  test.each(['unreachable', 'badAnswer', 'keyRejected', 'noSubscription', 'late', 'newer-code'])(
    'problem %s has words in both languages',
    (lastError) => {
      for (const [words, locale] of [[en.energy, 'en'], [nl.energy, 'nl']] as const) {
        const { text, problem } = energyPriceStateLine(
          view({ provider: 'tibber', status: 'error', lastError }),
          NOW,
          words,
          locale,
        )
        expect(problem).toBe(true)
        expect(text).toContain('Tibber')
        expect(text).toContain('13:35')
        expect(text).not.toMatch(/[{}]/)
      }
    },
  )
})
