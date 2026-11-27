import { describe, expect, test } from 'vitest'
import {
  enelogicDay,
  enelogicHours,
  enelogicMoment,
  enelogicProposals,
  enelogicRateChannel,
  enelogicRates,
  enelogicRef,
  enelogicStatistics,
  parseEnelogicRef,
  readEnelogicPoints,
  readEnelogicReadings,
} from './energyEnelogic'
import { hourlyAmountsFromSums } from './energyHomeAssistant'

const AMS = 'Europe/Amsterdam'
const HOUR = 3_600_000

describe('readEnelogicPoints', () => {
  test('keeps active points, telling gas from power', () => {
    expect(
      readEnelogicPoints([
        { id: 11, label: 'Stroom', dayMax: '2026-11-26 00:00:00' },
        { id: 12, label: 'Gas', unitType: 1, timezone: 'Europe/Amsterdam' },
        { id: 13, label: 'Old', active: false },
        { id: 'x' },
        null,
      ]),
    ).toEqual([
      {
        id: 11,
        label: 'Stroom',
        gas: false,
        timeZone: AMS,
        latest: '2026-11-26 00:00:00',
      },
      { id: 12, label: 'Gas', gas: true, timeZone: AMS, latest: null },
    ])
  })

  test('reads anything but a list as no points', () => {
    expect(readEnelogicPoints({ error: 'nope' })).toEqual([])
  })
})

describe('refs', () => {
  test('round-trip a point and register', () => {
    expect(parseEnelogicRef(enelogicRef(1234, 181))).toEqual({
      pointId: 1234,
      rate: 181,
    })
  })

  test('refuse what is not a ref', () => {
    expect(parseEnelogicRef('sensor.power')).toBeNull()
    expect(parseEnelogicRef('12:1810')).toBeNull()
  })
})

test('a register measures its channel', () => {
  expect(enelogicRateChannel(181, false)).toEqual({
    kind: 'gridImport',
    tariff: 't1',
  })
  expect(enelogicRateChannel(280, false)).toEqual({ kind: 'gridExport' })
  expect(enelogicRateChannel(180, true)).toEqual({ kind: 'gas' })
  expect(enelogicRateChannel(181, true)).toBeNull()
  expect(enelogicRateChannel(999, false)).toBeNull()
})

describe('enelogicMoment', () => {
  test('reads winter and summer time', () => {
    expect(enelogicMoment('2026-01-15 12:00:00', AMS)).toBe(
      Date.UTC(2026, 0, 15, 11),
    )
    expect(enelogicMoment('2026-07-15 12:00:00', AMS)).toBe(
      Date.UTC(2026, 6, 15, 10),
    )
  })

  test('reads the hour that happens twice as the first', () => {
    // 25 October 2026: 03:00 summer time becomes 02:00 winter time.
    expect(enelogicMoment('2026-10-25 02:00:00', AMS)).toBe(
      Date.UTC(2026, 9, 25, 0),
    )
  })

  test('reads a skipped wall time as the hour after', () => {
    // 29 March 2026: 02:00 winter time becomes 03:00 summer time.
    expect(enelogicMoment('2026-03-29 02:30:00', AMS)).toBe(
      Date.UTC(2026, 2, 29, 1, 30),
    )
    expect(enelogicMoment('2026-03-29 03:00:00', AMS)).toBe(
      Date.UTC(2026, 2, 29, 1),
    )
  })

  test('refuses what is not a wall time', () => {
    expect(enelogicMoment('yesterday', AMS)).toBeNull()
    expect(enelogicMoment('2026-01-15 12:00:00', 'Not/AZone')).toBeNull()
  })
})

test('enelogicDay is the local day', () => {
  // 23:30 UTC on 14 January is 00:30 on the 15th in Amsterdam.
  expect(enelogicDay(Date.UTC(2026, 0, 14, 23, 30), AMS)).toBe('2026-01-15')
})

describe('readings to hours', () => {
  const rows = [
    { id: 1, quantity: '100.0000', rate: 181, datetime: '2026-01-15 12:00:00' },
    { id: 2, quantity: '100.2500', rate: 181, datetime: '2026-01-15 12:15:00' },
    { id: 3, quantity: '101.0000', rate: 181, datetime: '2026-01-15 13:00:00' },
    { id: 4, quantity: '50.0000', rate: 182, datetime: '2026-01-15 13:00:00' },
    { id: 5, quantity: '102.5000', rate: 181, datetime: '2026-01-15 14:00:00' },
    { id: 6, quantity: 'n/a', rate: 181, datetime: '2026-01-15 15:00:00' },
  ]

  test('reads the valid rows, oldest first', () => {
    const readings = readEnelogicReadings([...rows].reverse(), AMS)
    expect(readings).toHaveLength(5)
    expect(readings[0]).toEqual({
      at: Date.UTC(2026, 0, 15, 11),
      rate: 181,
      quantity: 100,
    })
    expect(enelogicRates(readings)).toEqual([181, 182])
  })

  test('a reading at the top of an hour closes the hour before', () => {
    const readings = readEnelogicReadings(rows, AMS)
    const hours = enelogicHours(readings, 181)
    expect(hours.map((each) => each.hourStart)).toEqual([
      Date.UTC(2026, 0, 15, 10),
      Date.UTC(2026, 0, 15, 11),
      Date.UTC(2026, 0, 15, 12),
    ])
    const read = hourlyAmountsFromSums(hours, null)
    expect(read.amounts).toEqual([
      { hourStart: Date.UTC(2026, 0, 15, 11), amount: 1 },
      { hourStart: Date.UTC(2026, 0, 15, 12), amount: 1.5 },
    ])
  })

  test('reads day answers by their date', () => {
    expect(
      readEnelogicReadings(
        [{ quantity: 5, rate: 180, date: '2026-01-15 00:00:00' }],
        AMS,
      ),
    ).toEqual([{ at: Date.UTC(2026, 0, 14, 23), rate: 180, quantity: 5 }])
  })

  test('an hour a clock change repeats counts once', () => {
    const at = Date.UTC(2026, 9, 25, 0)
    const hours = enelogicHours(
      [
        { at, rate: 180, quantity: 1 },
        { at, rate: 180, quantity: 2 },
        { at: at + HOUR, rate: 180, quantity: 3 },
      ],
      180,
    )
    expect(hours.map((each) => each.sum)).toEqual([1, 3])
  })
})

describe('proposals', () => {
  const power = (id: number, latest: string, rates: number[]) => ({
    point: { id, label: `P${id}`, gas: false, timeZone: AMS, latest },
    rates,
  })
  const gas = {
    point: { id: 9, label: 'Gas', gas: true, timeZone: AMS, latest: null },
    rates: [180],
  }

  test('both tariffs both ways, from the newest power point, and gas', () => {
    expect(
      enelogicProposals([
        power(1, '2025-01-01', [180, 181, 182]),
        power(2, '2026-11-26', [181, 182, 281, 282]),
        gas,
      ]),
    ).toEqual([
      { kind: 'gridImport', tariff: 't1', statisticId: '2:181' },
      { kind: 'gridImport', tariff: 't2', statisticId: '2:182' },
      { kind: 'gridExport', tariff: 't1', statisticId: '2:281' },
      { kind: 'gridExport', tariff: 't2', statisticId: '2:282' },
      { kind: 'gas', statisticId: '9:180' },
    ])
  })

  test('the total where a tariff is missing', () => {
    expect(enelogicProposals([power(1, '2026-11-26', [180, 181])])).toEqual([
      { kind: 'gridImport', statisticId: '1:180' },
    ])
  })

  test('statistics name each register and leave out unknown ones', () => {
    expect(
      enelogicStatistics([power(1, '2026-11-26', [181, 999]), gas]),
    ).toEqual([
      { id: '1:181', name: 'P1 · 1.8.1', measure: 'energy' },
      { id: '9:180', name: 'Gas · 1.8.0', measure: 'volume' },
    ])
  })
})
