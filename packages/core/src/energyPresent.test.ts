import { describe, expect, test } from 'vitest'
import {
  compareYears,
  distinctPeakOf,
  energyChannelRows,
  energyHomeHasProblem,
  energyHomeSourceLine,
  energyHomeSources,
  energySourceLine,
  energyStaleStatistics,
  highestCostDay,
  highestUsageSlot,
  signedDifference,
} from './energyPresent'
import { en } from './messages/en'

const kwh = (size: number) => `${size.toFixed(0)} kWh`

describe('signedDifference', () => {
  test('says more or less with a sign', () => {
    expect(signedDifference(12.4, kwh)).toBe('+12 kWh')
    expect(signedDifference(-3, kwh)).toBe('−3 kWh')
  })

  test('a difference that rounds to nothing has no sign', () => {
    // Twelve months summed in two orders differ by float noise.
    const months = [0.1, 0.2, 0.3, 310.7, 280.2, 199.9]
    const compared = compareYears(
      [...months, ...months],
      [...months].reverse().concat([...months].reverse()),
      null,
    )
    expect(signedDifference(compared?.difference ?? 1, kwh)).toBe('0 kWh')
    expect(signedDifference(-0.2, kwh)).toBe('0 kWh')
  })
})

describe('energyHomeSources', () => {
  const ha = (over: object = {}) => ({
    kind: 'homeAssistant',
    status: 'ok' as const,
    ...over,
  })
  const manual = { kind: 'manual', status: 'ok' as const }
  const gone = ha({ status: 'needsReconnect', lastError: 'disconnected' })

  test('typed meters are named beside Home Assistant only while there are some', () => {
    expect(energyHomeSources([ha(), manual], 0)).toEqual([ha()])
    expect(energyHomeSources([ha(), manual], 2)).toEqual([ha(), manual])
    expect(energyHomeSources([manual], 0)).toEqual([manual])
  })

  test('a disconnected source gives way to typed meters', () => {
    expect(energyHomeSources([gone, manual], 2)).toEqual([manual])
    expect(energyHomeSources([gone], 0)).toEqual([gone])
  })

  test('a refused token is a problem, a first sync is not', () => {
    expect(energyHomeHasProblem([ha({ status: 'needsReconnect' })])).toBe(true)
    expect(energyHomeHasProblem([ha({ status: 'syncing' })])).toBe(false)
  })
})

describe('a sensor that stopped reporting (APP-728)', () => {
  const NOW = Date.UTC(2026, 10, 20, 9, 25)
  const source = {
    kind: 'homeAssistant',
    label: 'Home Assistant',
    status: 'ok' as const,
    lastSyncedAt: Date.UTC(2026, 10, 20, 9, 5),
    lastError: 'statisticStale|sensor.p1_import',
    channelCount: 2,
  }

  test('Sources says it in danger words while the source reads on', () => {
    expect(energySourceLine(source, NOW, en.energy, 'en')).toEqual({
      text: 'A sensor stopped reporting to Home Assistant: sensor.p1_import. Last updated 10:05.',
      problem: true,
    })
    expect(energyStaleStatistics(source)).toEqual(['sensor.p1_import'])
  })

  test('Home and a source in error are not told', () => {
    expect(energyHomeSourceLine(source, NOW, en.energy, 'en')).toBe(
      'Home Assistant · updated 10:05',
    )
    expect(energyHomeHasProblem([source])).toBe(false)
    expect(energyStaleStatistics({ ...source, status: 'error' })).toEqual([])
  })

  test('only the channel whose statistic stopped is flagged', () => {
    const rows = energyChannelRows(
      [
        { sourceId: 's', kind: 'gridImport', statisticId: 'sensor.p1_import' },
        { sourceId: 's', kind: 'batteryCharge', statisticId: 'sensor.charge' },
        { sourceId: 's', kind: 'batteryDischarge', statisticId: 'sensor.out' },
        { sourceId: 's', kind: 'gas', statisticId: 'sensor.gas' },
      ],
      en.energy,
      ['sensor.p1_import', 'sensor.out'],
    )
    expect(rows.map((each) => [each.key, each.stale])).toEqual([
      ['s:gridImport', true],
      ['s:batteryCharge', true],
      ['s:gas', false],
    ])
  })
})

describe('distinctPeakOf', () => {
  const peak = (values: (number | null)[]) =>
    distinctPeakOf(values, (value) => value)?.value ?? null
  test('is the highest when days differ', () => {
    expect(peak([1, null, 3, 2])).toBe(3)
    expect(peak([-5, 0, 1])).toBe(1)
  })
  test('a cent of net metering rounding is no highest day', () => {
    expect(highestCostDay([633, 634, 634], (cents) => cents)).toBeNull()
    expect(highestCostDay([633, 635], (cents) => cents)?.value).toBe(635)
  })
  test('is nothing when every day is the same, zero, or there are none', () => {
    expect(peak([3, null, 3])).toBeNull()
    expect(peak([0, 0])).toBeNull()
    expect(peak([null])).toBeNull()
    expect(peak([])).toBeNull()
  })
})

describe('highestUsageSlot', () => {
  const peak = (values: (number | null)[]) =>
    highestUsageSlot(values, (value) => value)?.value ?? null
  test('names the highest slot when one stands out', () => {
    expect(peak([10, 10, 18, 10])).toBe(18)
  })
  test('names none when every slot uses the same, or differs by noise', () => {
    expect(peak([10, 10, 10])).toBeNull()
    expect(peak([10, 10.001, 9.999])).toBeNull()
    expect(peak([10])).toBeNull()
  })
})
