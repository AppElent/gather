import { describe, expect, test } from 'vitest'
import {
  energyChannelsOverlap,
  energyProposals,
  energyReadingOverdue,
  energySourceProblemValue,
  energyStatisticStale,
  hourlyAmountsFromSums,
  hourlyLevels,
  readEnergySourceProblem,
  readHaHours,
  readHaStatistics,
} from './energyHomeAssistant'
import { amsterdamDayOf, amsterdamDayStart } from './energyUsage'

const HOUR = 3_600_000
const energy = (statistic_id: string) => ({
  statistic_id,
  name: null,
  has_sum: true,
  statistics_unit_of_measurement: 'kWh',
  unit_class: 'energy',
})

describe('the statistics a channel can read', () => {
  test('counters of energy and volume, and levels in percent', () => {
    expect(
      readHaStatistics([
        energy('sensor.import'),
        { statistic_id: 'sensor.gas', has_sum: true, statistics_unit_of_measurement: 'm³' },
        { statistic_id: 'sensor.soc', mean_type: 1, statistics_unit_of_measurement: '%' },
        // Not usable: a temperature, a power average, a cost, a bare row.
        { statistic_id: 'sensor.t', has_mean: true, statistics_unit_of_measurement: '°C' },
        { statistic_id: 'sensor.w', has_mean: true, statistics_unit_of_measurement: 'W' },
        { statistic_id: 'sensor.eur', has_sum: true, statistics_unit_of_measurement: 'EUR' },
        null,
        'sensor.text',
        { has_sum: true },
      ]).map((each) => [each.id, each.measure]),
    ).toEqual([
      ['sensor.import', 'energy'],
      ['sensor.gas', 'volume'],
      ['sensor.soc', 'percent'],
    ])
  })
  test('anything but a list is no statistics', () => {
    expect(readHaStatistics({})).toEqual([])
    expect(readHaStatistics(null)).toEqual([])
  })
})

describe('what the Energy dashboard proposes', () => {
  const split = [
    'sensor.electricity_meter_energy_import_tariff_1',
    'sensor.electricity_meter_energy_import_tariff_2',
  ]
  test('a HomeWizard P1 with two tariffs, in either shape of the preferences', () => {
    const statistics = readHaStatistics(split.map(energy))
    const lists = energyProposals(
      {
        energy_sources: [
          {
            type: 'grid',
            flow_from: split.map((id) => ({ stat_energy_from: id })),
            flow_to: [],
          },
        ],
      },
      statistics,
    )
    const pairs = energyProposals(
      {
        energy_sources: split.map((id) => ({
          type: 'grid',
          stat_energy_from: id,
          stat_energy_to: null,
        })),
      },
      statistics,
    )
    expect(lists.map((each) => [each.kind, each.tariff, each.available])).toEqual([
      ['gridImport', 't1', true],
      ['gridImport', 't2', true],
    ])
    expect(pairs).toEqual(lists)
  })
  test.each([
    ['a single total', ['sensor.zonneplan_import'], [undefined]],
    ['two meters that are not tariffs', ['sensor.house', 'sensor.barn'], [undefined, undefined]],
    ['Dutch names', ['sensor.import_dal', 'sensor.import_normaal'], ['t1', 't2']],
    ['English DSMR names', ['sensor.import_tarif_1', 'sensor.import_tarif_2'], ['t1', 't2']],
    ['a total beside a split pair', ['sensor.p1_import', 'sensor.p1_import_tariff_1', 'sensor.p1_import_tariff_2'], [undefined, 't1', 't2']],
    ['two of one tariff', ['sensor.a_tariff_1', 'sensor.b_tariff_1'], [undefined, undefined]],
  ])('%s', (_, ids, tariffs) => {
    expect(
      energyProposals(
        {
          energy_sources: [
            { type: 'grid', flow_from: ids.map((id) => ({ stat_energy_from: id })) },
          ],
        },
        [],
      ).map((each) => each.tariff),
    ).toEqual(tariffs)
  })
  test('the battery’s directions are its own, and its level is only a guess', () => {
    const proposals = energyProposals(
      {
        energy_sources: [
          { type: 'battery', stat_energy_from: 'sensor.out', stat_energy_to: 'sensor.in' },
        ],
      },
      readHaStatistics([
        energy('sensor.out'),
        energy('sensor.in'),
        { statistic_id: 'sensor.battery_soc', has_mean: true, statistics_unit_of_measurement: '%' },
      ]),
    )
    expect(
      proposals.map((each) => [each.kind, each.statisticId, each.fromDashboard]),
    ).toEqual([
      ['batteryCharge', 'sensor.in', true],
      ['batteryDischarge', 'sensor.out', true],
      ['batterySoc', 'sensor.battery_soc', false],
    ])
  })
  test('a sensor without a usable statistic is not available', () => {
    expect(
      energyProposals(
        { energy_sources: [{ type: 'gas', stat_energy_from: 'sensor.gas' }] },
        readHaStatistics([energy('sensor.gas')]),
      )[0]?.available,
    ).toBe(false)
  })
  test('nonsense proposes nothing', () => {
    for (const prefs of [null, [], {}, { energy_sources: 'x' }, { energy_sources: [null, 3] }]) {
      expect(energyProposals(prefs, [])).toEqual([])
    }
  })
})

describe('sums into hours', () => {
  const hours = (...sums: (number | null)[]) =>
    sums.map((sum, index) => ({ hourStart: index * HOUR, sum, mean: null }))

  test('each hour is the difference with the one before', () => {
    expect(hourlyAmountsFromSums(hours(100, 100.5, 102), null)).toEqual({
      amounts: [
        { hourStart: HOUR, amount: 0.5 },
        { hourStart: 2 * HOUR, amount: 1.5 },
      ],
      baseline: 102,
    })
  })
  test('carries the baseline into the next window', () => {
    const first = hourlyAmountsFromSums(hours(100, 101), null)
    expect(
      hourlyAmountsFromSums(
        [{ hourStart: 2 * HOUR, sum: 103, mean: null }],
        first.baseline,
      ).amounts,
    ).toEqual([{ hourStart: 2 * HOUR, amount: 2 }])
  })
  test('a meter that restarts never counts negative, and goes on from there', () => {
    expect(
      hourlyAmountsFromSums(hours(500, 501, 0.2, 0.9), null).amounts.map(
        (each) => each.amount,
      ),
    ).toEqual([1, 0, 0.7])
  })
  test('a missed hour lands on the next one', () => {
    expect(
      hourlyAmountsFromSums(
        [
          { hourStart: 0, sum: 1, mean: null },
          { hourStart: 3 * HOUR, sum: 4, mean: null },
        ],
        null,
      ).amounts,
    ).toEqual([{ hourStart: 3 * HOUR, amount: 3 }])
  })
  test('an hour without a sum is skipped', () => {
    expect(
      hourlyAmountsFromSums(hours(1, null, 4), null).amounts,
    ).toEqual([{ hourStart: 2 * HOUR, amount: 3 }])
  })
  test('no float noise', () => {
    expect(
      hourlyAmountsFromSums(hours(0.1, 0.3), null).amounts[0]?.amount,
    ).toBe(0.2)
  })
  test.each([
    ['the spring change', '2026-03-29', 23],
    ['an ordinary day', '2026-06-01', 24],
    ['the autumn change', '2026-10-25', 25],
  ])('%s has all its hours, each once', (_, day, count) => {
    const start = amsterdamDayStart(day)
    const { amounts } = hourlyAmountsFromSums(
      Array.from({ length: 30 }, (_each, index) => ({
        hourStart: start + (index - 1) * HOUR,
        sum: index,
        mean: null,
      })),
      null,
    )
    const own = amounts.filter((each) => amsterdamDayOf(each.hourStart) === day)
    expect(own).toHaveLength(count)
    expect(own.reduce((total, each) => total + each.amount, 0)).toBe(count)
  })
  test('levels stay as they are', () => {
    expect(
      hourlyLevels([
        { hourStart: 0, sum: null, mean: 40 },
        { hourStart: HOUR, sum: null, mean: null },
      ]),
    ).toEqual([{ hourStart: 0, amount: 40 }])
  })
})

describe('rows from Home Assistant', () => {
  test('milliseconds and ISO text alike, oldest first, one per hour', () => {
    expect(
      readHaHours([
        { start: HOUR, sum: 2 },
        { start: new Date(0).toISOString(), sum: 1, mean: null },
        { start: HOUR, sum: 3 },
        { start: 'never', sum: 9 },
        { sum: 9 },
        null,
        { start: 2 * HOUR, sum: Number.NaN },
      ]),
    ).toEqual([
      { hourStart: 0, sum: 1, mean: null },
      { hourStart: HOUR, sum: 3, mean: null },
      { hourStart: 2 * HOUR, sum: null, mean: null },
    ])
    expect(readHaHours(undefined)).toEqual([])
  })
})

describe('channels, problems and overdue meters', () => {
  test('overlap is the same kind, and a tariff both count', () => {
    const t1 = { kind: 'gridImport', tariff: 't1' } as const
    const t2 = { kind: 'gridImport', tariff: 't2' } as const
    const all = { kind: 'gridImport' } as const
    expect(energyChannelsOverlap(t1, t2)).toBe(false)
    expect(energyChannelsOverlap(t1, all)).toBe(true)
    expect(energyChannelsOverlap(all, all)).toBe(true)
    expect(energyChannelsOverlap(all, { kind: 'gridExport' })).toBe(false)
  })
  test('a problem survives being stored', () => {
    expect(
      readEnergySourceProblem(
        energySourceProblemValue('statisticMissing', ['sensor.a', 'sensor.b']),
      ),
    ).toEqual({ problem: 'statisticMissing', statistics: ['sensor.a', 'sensor.b'] })
    expect(readEnergySourceProblem(undefined)).toBeNull()
    expect(readEnergySourceProblem('something new')?.problem).toBe('unreachable')
  })
  test('a statistic goes stale after its kind’s quiet hours', () => {
    const now = 100 * 24 * HOUR
    for (const [kind, hours] of [
      ['gridImport', 6],
      ['gas', 48],
      ['solar', 72],
      ['batteryCharge', 72],
      ['batterySoc', 72],
    ] as const) {
      expect(energyStatisticStale(kind, now - hours * HOUR, now)).toBe(false)
      expect(energyStatisticStale(kind, now - hours * HOUR - 1, now)).toBe(true)
    }
    // A solar inverter asleep through a winter night is not flagged.
    expect(energyStatisticStale('solar', now - 16 * HOUR, now)).toBe(false)
  })
  test('a typed meter is overdue after two weeks', () => {
    const now = 100 * 24 * HOUR
    expect(energyReadingOverdue(now - 14 * 24 * HOUR, now)).toBe(false)
    expect(energyReadingOverdue(now - 14 * 24 * HOUR - 1, now)).toBe(true)
    expect(energyReadingOverdue(null, now)).toBe(true)
  })
})
