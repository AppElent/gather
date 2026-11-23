import { energyMonthDays } from '@gather/core/energy'
import type { EnergyPeriod } from './energyShared'

/**
 * Builders for the Energy page tests: a period as `energyUsage.month` and
 * `energyUsage.day` return it, with sample figures that are easy to read.
 */

type Day = EnergyPeriod['days'][number]
type Cost = NonNullable<Day['cost']>

export function cost(totalCents: number, parts: Partial<Cost> = {}): Cost {
  return {
    importCents: totalCents,
    exportCents: 0,
    gasCents: 0,
    fixedCents: 0,
    creditCents: 0,
    totalCents,
    ...parts,
  }
}

export function day(date: string, overrides: Partial<Day> = {}): Day {
  return {
    day: date,
    hasData: true,
    estimated: false,
    importKwh: 10,
    exportKwh: 2,
    solarKwh: null,
    gasM3: null,
    batteryChargeKwh: null,
    batteryDischargeKwh: null,
    consumptionKwh: 10,
    cost: cost(300),
    costWithoutNet: cost(350),
    costStatus: 'ok',
    ...overrides,
  }
}

export const CHANNELS = {
  gridImport: true,
  gridExport: true,
  solar: false,
  gas: false,
  battery: false,
  batterySoc: false,
}

/** A month up to `today`: every past day with figures, the rest to come. */
export function monthPeriod(
  month: string,
  today: string,
  overrides: Partial<EnergyPeriod> = {},
  dayOverrides: Partial<Day> = {},
): EnergyPeriod {
  const days = energyMonthDays(month).map((date) =>
    date <= today
      ? day(date, dayOverrides)
      : day(date, {
          hasData: false,
          importKwh: 0,
          exportKwh: 0,
          consumptionKwh: 0,
          cost: null,
          costWithoutNet: null,
          costStatus: 'noData',
        }),
  )
  const past = days.filter((each) => each.hasData)
  const sum = (pick: (each: Day) => number) =>
    past.reduce((total, each) => total + pick(each), 0)
  const costSum = (pick: (each: Day) => Cost | null) =>
    past.some((each) => pick(each))
      ? cost(sum((each) => pick(each)?.totalCents ?? 0))
      : null
  return {
    siteName: 'Thuis',
    hasHourly: false,
    channels: CHANNELS,
    contract: {
      kind: 'dynamic',
      supplierName: 'Zonneplan',
      validFrom: '2026-01-01',
      netMetering: true,
    },
    netMeteringChoice: true,
    days,
    hours: [],
    totals: {
      importKwh: sum((each) => each.importKwh),
      exportKwh: sum((each) => each.exportKwh),
      solarKwh: null,
      gasM3: null,
      consumptionKwh: sum((each) => each.consumptionKwh),
      estimated: past.some((each) => each.estimated),
      daysWithData: past.length,
      firstDay: past[0]?.day ?? null,
      lastDay: past[past.length - 1]?.day ?? null,
      cost: costSum((each) => each.cost),
      costWithoutNet: costSum((each) => each.costWithoutNet),
      costMissingDays: 0,
      costStatus: past.length === 0 ? 'noData' : 'ok',
    },
    ...overrides,
  }
}
