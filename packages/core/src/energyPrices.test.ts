import { describe, expect, test } from 'vitest'
import dst from './__fixtures__/energyPrices/energyzero-autumn-dst.json'
import electricity from './__fixtures__/energyPrices/energyzero-electricity.json'
import gas from './__fixtures__/energyPrices/energyzero-gas.json'
import {
  amsterdamDayHours,
  amsterdamDayStart,
  averageEnergyPrice,
  cheapestEnergyBlock,
  checkEnergyPriceKey,
  completeElectricityDay,
  completeGasDay,
  EnergyPriceAnswerError,
  type EnergyPriceHour,
  type EnergyPriceSlot,
  energyContractOn,
  energyDayQuarters,
  energyExportPrice,
  energyHourAt,
  energyImportPrice,
  energyPriceHeights,
  energyPriceHours,
  energyPriceParts,
  energyTomorrowDue,
  gasDayStart,
  judgeEnergyPrice,
  mostExpensiveEnergyHour,
  negativeEnergyWindows,
  nextCheapestEnergyBlock,
  readEnergyPriceProblem,
  readEnergyZeroPrices,
  readEntsoePrices,
  readTibberPrices,
} from './energy'

const HOUR = 3_600_000
const QUARTER = 900_000

function problemOf(read: () => unknown) {
  try {
    read()
  } catch (error) {
    return error instanceof EnergyPriceAnswerError ? error.problem : 'other'
  }
  return null
}

/** Hours of one day from midnight on, priced as given. */
function hoursOf(day: string, prices: readonly number[]): EnergyPriceHour[] {
  return amsterdamDayHours(day).map((start, index) => ({
    start,
    price: prices[index] ?? 0,
    market: prices[index] ?? 0,
  }))
}

describe('whole days', () => {
  test('a day has 96 quarters, 92 in spring and 100 in autumn', () => {
    expect(energyDayQuarters('2026-11-23')).toBe(96)
    expect(energyDayQuarters('2026-03-29')).toBe(92)
    expect(energyDayQuarters('2026-10-25')).toBe(100)
  })

  const slots = (day: string): EnergyPriceSlot[] =>
    Array.from({ length: energyDayQuarters(day) }, (_, index) => ({
      start: amsterdamDayStart(day) + index * QUARTER,
      minutes: 15,
      eurPerUnit: 0.1,
    }))

  test.each(['2026-11-23', '2026-03-29', '2026-10-25'])(
    'all of %s is a day, one quarter short is not',
    (day) => {
      const whole = slots(day)
      expect(completeElectricityDay(day, [...whole].reverse())).toEqual(whole)
      expect(completeElectricityDay(day, whole.slice(1))).toBeNull()
      expect(completeElectricityDay(day, whole.slice(0, -1))).toBeNull()
    },
  )

  test('a gap, a double, an hour price or an absurd one is not a day', () => {
    const day = '2026-11-23'
    const whole = slots(day)
    const with_ = (change: Partial<EnergyPriceSlot>) =>
      whole.map((slot, index) => (index === 5 ? { ...slot, ...change } : slot))
    expect(
      completeElectricityDay(day, with_({ start: whole[4]?.start ?? 0 })),
    ).toBeNull()
    expect(completeElectricityDay(day, [...whole, whole[0] as EnergyPriceSlot])).toBeNull()
    expect(completeElectricityDay(day, with_({ minutes: 60 }))).toBeNull()
    expect(completeElectricityDay(day, with_({ eurPerUnit: 195 }))).toBeNull()
    expect(completeElectricityDay(day, with_({ eurPerUnit: Number.NaN }))).toBeNull()
  })

  test("another day's quarters do not count", () => {
    const both = [...slots('2026-11-23'), ...slots('2026-11-24')]
    expect(completeElectricityDay('2026-11-24', both)).toHaveLength(96)
    expect(completeElectricityDay('2026-11-25', both)).toBeNull()
  })

  test('a gas day runs from 06:00 to 06:00, also when the clocks change', () => {
    expect(new Date(gasDayStart('2026-11-23')).toISOString()).toBe(
      '2026-11-23T05:00:00.000Z',
    )
    expect(new Date(gasDayStart('2026-07-01')).toISOString()).toBe(
      '2026-07-01T04:00:00.000Z',
    )
    // The clocks change at 03:00, inside the gas day that started the day before.
    const short = { start: gasDayStart('2026-03-28'), minutes: 23 * 60, eurPerUnit: 1 }
    expect(completeGasDay('2026-03-28', [short])).toEqual([short])
    expect(completeGasDay('2026-03-28', [{ ...short, minutes: 1440 }])).toBeNull()
  })

  test('tomorrow is due from 15:00 Amsterdam time', () => {
    expect(energyTomorrowDue(Date.parse('2026-11-23T13:59:00Z'))).toBe(false)
    expect(energyTomorrowDue(Date.parse('2026-11-23T14:00:00Z'))).toBe(true)
    expect(energyTomorrowDue(Date.parse('2026-07-01T12:59:00Z'))).toBe(false)
    expect(energyTomorrowDue(Date.parse('2026-07-01T13:00:00Z'))).toBe(true)
  })
})

describe('EnergyZero', () => {
  test('a recorded answer holds two whole days', () => {
    const slots = readEnergyZeroPrices(electricity)
    expect(slots).toHaveLength(192)
    expect(slots[0]).toEqual({
      start: Date.parse('2026-11-22T23:00:00Z'),
      minutes: 15,
      eurPerUnit: 0.195,
    })
    expect(completeElectricityDay('2026-11-23', slots)).toHaveLength(96)
    expect(completeElectricityDay('2026-11-24', slots)).toHaveLength(96)
    expect(completeElectricityDay('2026-11-25', slots)).toBeNull()
  })

  test('the recorded day of 25 hours has 100 quarters and 25 hours', () => {
    const slots = readEnergyZeroPrices(dst)
    expect(completeElectricityDay('2026-10-25', slots)).toHaveLength(100)
    expect(energyPriceHours('2026-10-25', slots)).toHaveLength(25)
  })

  test('recorded gas is one price per gas day', () => {
    const slots = readEnergyZeroPrices(gas)
    expect(completeGasDay('2026-11-23', slots)).toEqual([
      {
        start: Date.parse('2026-11-23T05:00:00Z'),
        minutes: 1440,
        eurPerUnit: 0.865836513388,
      },
    ])
    expect(completeGasDay('2026-11-24', slots)).toHaveLength(1)
    expect(completeGasDay('2026-11-25', slots)).toBeNull()
  })

  test.each([
    null,
    'text',
    {},
    { base: 'x' },
    { base: [null] },
    { base: [{ start: '2026-11-23T00:00:00', end: '2026-11-23T00:15:00Z', price: { value: '1' } }] },
    { base: [{ start: '2026-11-23T00:00:00Z', end: '2026-11-23T00:15:00Z', price: { value: '' } }] },
    { base: [{ start: '2026-11-23T00:00:00Z', end: '2026-11-23T00:15:00Z', price: { value: 'veel' } }] },
  ])('refuses an answer it does not know (%#)', (answer) => {
    expect(problemOf(() => readEnergyZeroPrices(answer))).toBe('badAnswer')
  })
})

/** An A44 document, in the published format. */
function entsoe({
  curve = 'A03',
  sequence,
  resolution = 'PT15M',
  unit = 'MWH',
  start = '2026-11-22T23:00Z',
  end = '2026-11-23T23:00Z',
  points,
}: {
  curve?: string
  sequence?: number
  resolution?: string
  unit?: string
  start?: string
  end?: string
  points: readonly [position: number, amount: number][]
}) {
  return `<TimeSeries>
    <mRID>1</mRID><businessType>A62</businessType>
    <currency_Unit.name>EUR</currency_Unit.name>
    <price_Measure_Unit.name>${unit}</price_Measure_Unit.name>
    <curveType>${curve}</curveType>
    ${sequence ? `<classificationSequence_AttributeInstanceComponent.position>${sequence}</classificationSequence_AttributeInstanceComponent.position>` : ''}
    <Period><timeInterval><start>${start}</start><end>${end}</end></timeInterval>
    <resolution>${resolution}</resolution>
    ${points.map(([position, amount]) => `<Point><position>${position}</position><price.amount>${amount}</price.amount></Point>`).join('\n')}
    </Period></TimeSeries>`
}
const publication = (...series: string[]) =>
  `<?xml version="1.0" encoding="utf-8"?><Publication_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"><mRID>x</mRID>${series.join('')}</Publication_MarketDocument>`

describe('ENTSO-E', () => {
  const all = Array.from(
    { length: 96 },
    (_, index) => [index + 1, 80 + index] as [number, number],
  )

  test('euros per MWh become euros per kWh, per quarter', () => {
    const slots = readEntsoePrices(publication(entsoe({ points: all })))
    expect(slots).toHaveLength(96)
    expect(slots?.[0]).toEqual({
      start: Date.parse('2026-11-22T23:00:00Z'),
      minutes: 15,
      eurPerUnit: 0.08,
    })
    expect(completeElectricityDay('2026-11-23', slots ?? [])).toHaveLength(96)
  })

  test('an A03 curve repeats a price it leaves out', () => {
    const slots = readEntsoePrices(
      publication(entsoe({ points: [[1, 80], [2, -5], [96, 120]] })),
    )
    expect(slots).toHaveLength(96)
    expect(slots?.[1]?.eurPerUnit).toBe(-0.005)
    expect(slots?.[94]?.eurPerUnit).toBe(-0.005)
    expect(slots?.[95]?.eurPerUnit).toBe(0.12)
  })

  test('an A01 curve with a gap stays incomplete', () => {
    const slots = readEntsoePrices(
      publication(entsoe({ curve: 'A01', points: all.filter(([at]) => at !== 7) })),
    )
    expect(completeElectricityDay('2026-11-23', slots ?? [])).toBeNull()
  })

  test('of two auctions the first counts, whatever the order', () => {
    const one = entsoe({ sequence: 1, points: [[1, 80]] })
    const two = entsoe({ sequence: 2, points: [[1, 99]] })
    for (const xml of [publication(one, two), publication(two, one)]) {
      expect(readEntsoePrices(xml)?.[0]?.eurPerUnit).toBe(0.08)
    }
  })

  test('hour prices beside the quarters are left out', () => {
    const xml = publication(entsoe({ resolution: 'PT60M', points: [[1, 80]] }))
    expect(readEntsoePrices(xml)).toEqual([])
  })

  test('namespaced tags read the same', () => {
    const xml = publication(entsoe({ points: all })).replace(/<(\/?)(\w)/g, '<$1ns:$2')
    expect(readEntsoePrices(xml)).toHaveLength(96)
  })

  test('a day that is not published yet is null', () => {
    expect(
      readEntsoePrices(
        '<Acknowledgement_MarketDocument xmlns="x"><Reason><code>999</code><text>No matching data found for Data item Day-ahead Prices</text></Reason></Acknowledgement_MarketDocument>',
      ),
    ).toBeNull()
  })

  test.each([
    '',
    '<html></html>',
    '<Acknowledgement_MarketDocument><Reason><text>Delivered time interval is not valid</text></Reason></Acknowledgement_MarketDocument>',
    publication(entsoe({ unit: 'KWH', points: [[1, 80]] })),
    publication(entsoe({ points: [[97, 80]] })),
    publication(entsoe({ points: [[0, 80]] })),
    publication(entsoe({ start: 'yesterday', points: [[1, 80]] })),
    publication(entsoe({ end: '2099-01-01T00:00Z', points: [[1, 80]] })),
    publication(entsoe({ points: [[1, 80_000_000]] })),
  ])('refuses a document it does not know (%#)', (xml) => {
    expect(problemOf(() => readEntsoePrices(xml))).toBe('badAnswer')
  })
})

describe('Tibber', () => {
  const day = (start: number, count = 96) =>
    Array.from({ length: count }, (_, index) => ({
      total: 0.3 + index / 1000,
      startsAt: new Date(start + index * QUARTER).toISOString().replace('Z', '+00:00'),
      currency: 'EUR',
    }))
  const answer = (priceInfo: unknown) => ({
    data: {
      viewer: {
        homes: [
          { currentSubscription: null },
          { currentSubscription: priceInfo === null ? null : { priceInfo } },
        ],
      },
    },
  })
  const start = amsterdamDayStart('2026-11-23')

  test("the first home with a running contract, today and tomorrow", () => {
    const slots = readTibberPrices(
      answer({ today: day(start), tomorrow: day(start + 24 * HOUR) }),
    )
    expect(slots).toHaveLength(192)
    expect(slots[0]).toEqual({ start, minutes: 15, eurPerUnit: 0.3 })
    expect(completeElectricityDay('2026-11-24', slots)).toHaveLength(96)
  })

  test('before publication tomorrow is simply not there', () => {
    const slots = readTibberPrices(answer({ today: day(start), tomorrow: [] }))
    expect(slots).toHaveLength(96)
  })

  test('the recorded refusal of a key', () => {
    expect(
      problemOf(() =>
        readTibberPrices({
          errors: [
            {
              message: 'No valid access token in request',
              locations: [{ line: 1, column: 3 }],
              path: ['viewer'],
              extensions: { code: 'UNAUTHENTICATED' },
            },
          ],
          data: null,
        }),
      ),
    ).toBe('keyRejected')
  })

  test('no contract, another currency, or something else', () => {
    expect(problemOf(() => readTibberPrices(answer(null)))).toBe('noSubscription')
    expect(
      problemOf(() =>
        readTibberPrices(answer({ today: [{ ...day(start, 1)[0], currency: 'NOK' }] })),
      ),
    ).toBe('badAnswer')
    expect(problemOf(() => readTibberPrices({ errors: [{ message: 'x' }] }))).toBe(
      'badAnswer',
    )
    expect(problemOf(() => readTibberPrices('<html>'))).toBe('badAnswer')
  })
})

describe('keys and problems', () => {
  test('a key is printable and without spaces', () => {
    expect(checkEnergyPriceKey('  abc-123_X  ')).toBe('abc-123_X')
    expect(checkEnergyPriceKey('a b')).toBeNull()
    expect(checkEnergyPriceKey('a\r\nX-Evil: 1')).toBeNull()
    expect(checkEnergyPriceKey('sleutel–1')).toBeNull()
    expect(checkEnergyPriceKey('')).toBeNull()
    expect(checkEnergyPriceKey('x'.repeat(501))).toBeNull()
  })

  test('an unknown stored problem still reads as one', () => {
    expect(readEnergyPriceProblem(undefined)).toBeNull()
    expect(readEnergyPriceProblem('late')).toBe('late')
    expect(readEnergyPriceProblem('something new')).toBe('unreachable')
  })
})

const TERMS = {
  importMarkupEurPerKwh: 0.02,
  exportFeeEurPerKwh: -0.01,
  energyTaxEurPerKwh: 0.1,
  vatPercent: 21,
}

describe('the all-in price', () => {
  test('market, markup and tax, plus VAT', () => {
    expect(energyImportPrice(0.1, TERMS)).toBeCloseTo(0.2662)
    expect(energyExportPrice(0.1, TERMS)).toBeCloseTo(0.09)
    expect(energyExportPrice(-0.02, TERMS)).toBeCloseTo(-0.03)
  })

  test('its parts add up to it', () => {
    const parts = energyPriceParts(0.1, TERMS)
    expect(parts.market + parts.markup + parts.tax + parts.vat).toBeCloseTo(
      parts.total,
    )
    expect(parts.vat).toBeCloseTo(0.0462)
  })

  test('31 December and 1 January each use their own contract', () => {
    const contracts = [
      { ...TERMS, validFrom: '2026-01-01' },
      { ...TERMS, validFrom: '2027-01-01', energyTaxEurPerKwh: 0.12 },
    ]
    const price = (day: string) => {
      const contract = energyContractOn(contracts, day)
      return contract ? energyImportPrice(0.1, contract) : null
    }
    expect(price('2026-12-31')).toBeCloseTo((0.1 + 0.02 + 0.1) * 1.21)
    expect(price('2027-01-01')).toBeCloseTo((0.1 + 0.02 + 0.12) * 1.21)
  })

  test("an hour's price is the average of its quarters", () => {
    const day = '2026-11-23'
    const slots = Array.from({ length: 96 }, (_, index) => ({
      start: amsterdamDayStart(day) + index * QUARTER,
      minutes: 15,
      eurPerUnit: [0.1, 0.2, 0.3, 0.6][index % 4] as number,
    }))
    const hours = energyPriceHours(day, slots)
    expect(hours).toHaveLength(24)
    expect(hours?.[0]?.eurPerUnit).toBeCloseTo(0.3)
    expect(energyPriceHours(day, slots.slice(1))).toBeNull()
  })
})

describe('what a day says', () => {
  const day = '2026-11-23'
  const flat = Array.from({ length: 24 }, () => 0.3)
  const with_ = (changes: Record<number, number>) =>
    hoursOf(day, flat.map((price, index) => changes[index] ?? price))

  test('the cheapest three hours in a row', () => {
    const hours = with_({ 2: 0.1, 13: 0.2, 14: 0.15, 15: 0.2 })
    expect(cheapestEnergyBlock(hours)).toMatchObject({
      start: hours[13]?.start,
      end: hours[16]?.start,
    })
    expect(cheapestEnergyBlock(hours)?.average).toBeCloseTo(0.55 / 3)
  })

  test('on a tie the first block, and never over a gap', () => {
    const hours = with_({})
    expect(cheapestEnergyBlock(hours)?.start).toBe(hours[0]?.start)
    expect(cheapestEnergyBlock([hours[0], hours[1], hours[3]] as EnergyPriceHour[])).toBeNull()
    expect(cheapestEnergyBlock(hours.slice(0, 2))).toBeNull()
  })

  test('average, most expensive and the hour it is', () => {
    const hours = with_({ 18: 0.54 })
    expect(averageEnergyPrice(hours)).toBeCloseTo(0.31)
    expect(mostExpensiveEnergyHour(hours)).toBe(hours[18])
    expect(energyHourAt(hours, (hours[5]?.start ?? 0) + HOUR - 1)).toBe(hours[5])
    expect(energyHourAt(hours, (hours[23]?.start ?? 0) + HOUR)).toBeNull()
    expect(averageEnergyPrice([])).toBeNull()
  })

  test('the next block has yet to start, today or tomorrow', () => {
    const today = with_({ 2: 0.1, 3: 0.1, 4: 0.1, 21: 0.2, 22: 0.2, 23: 0.2 })
    const now = (today[12]?.start ?? 0) + 60_000
    expect(nextCheapestEnergyBlock(today, null, now)).toMatchObject({
      on: 'today',
      start: today[21]?.start,
    })
    const tomorrow = hoursOf('2026-11-24', flat.map((_, at) => (at < 3 ? 0.15 : 0.3)))
    expect(nextCheapestEnergyBlock(today, tomorrow, now)).toMatchObject({
      on: 'tomorrow',
      start: tomorrow[0]?.start,
    })
    expect(
      nextCheapestEnergyBlock(today, null, today[22]?.start ?? 0),
    ).toBeNull()
  })

  test.each([
    [0.37, 0.3, 'expensive', 23],
    [0.32, 0.3, 'average', 7],
    [0.28, 0.3, 'average', -7],
    [0.2, 0.3, 'cheap', -33],
    [0.2, 0, 'expensive', null],
    [0, 0, 'average', null],
    [-0.2, -0.1, 'cheap', null],
  ] as const)('%d against %d is %s', (price, average, judgement, percent) => {
    expect(judgeEnergyPrice(price, average)).toEqual({ judgement, percent })
  })

  test('negative hours next to each other are one window', () => {
    const hours = with_({ 12: -0.02, 13: -0.04, 20: -0.01 })
    const windows = negativeEnergyWindows(hours, -0.01)
    expect(windows).toHaveLength(2)
    expect(windows[0]).toMatchObject({ start: hours[12]?.start, end: hours[14]?.start })
    expect(windows[0]?.eurPerKwh).toBeCloseTo(0.04)
    // A bonus larger than the negative price still earns something.
    expect(negativeEnergyWindows(hours, 0.1)[0]?.eurPerKwh).toBeNull()
    expect(negativeEnergyWindows(hours, null)[0]?.eurPerKwh).toBeNull()
    expect(negativeEnergyWindows(with_({}), -0.01)).toEqual([])
  })

  test('bars scale to the highest price and never vanish', () => {
    expect(energyPriceHeights([{ price: 0.4 }, { price: 0.2 }, { price: -0.1 }])).toEqual([
      1, 0.5, 0.03,
    ])
    expect(energyPriceHeights([{ price: -0.1 }])).toEqual([0.03])
  })
})
