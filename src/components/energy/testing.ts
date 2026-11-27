import { amsterdamDayHours, energyMonthDays } from '@gather/core/energy'
import type { EnergyPriceDay, EnergyPriceView } from '@gather/core/energy-present'
import type { EnergyPeriod } from './energyShared'
import type { EnergyAssetRow, EnergySolarMonth } from './energySolarCharts'

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

/**
 * Prices as `energyPrices.view` returns them, for 20 and 21 November 2026:
 * 30 cents, with 20 in hours 2 to 4 and 40 at 19:00; tomorrow 10 from 13:00.
 */
export function priceDay(
  date: string,
  changes: Record<number, number>,
  overrides: Partial<EnergyPriceDay> = {},
): EnergyPriceDay {
  return {
    day: date,
    provider: 'energyzero',
    basis: 'allIn',
    terms: {
      supplierName: 'Frank Energie',
      importMarkupEurPerKwh: 0.02,
      energyTaxEurPerKwh: 0.1,
      vatPercent: 21,
    },
    exportFeeEurPerKwh: -0.01,
    hours: amsterdamDayHours(date).map((start, index) => {
      const price = changes[index] ?? 0.3
      return { start, price, market: price / 1.21 - 0.12 }
    }),
    ...overrides,
  }
}

export function priceView(overrides: Partial<EnergyPriceView> = {}): EnergyPriceView {
  return {
    siteName: 'Thuis',
    canManage: true,
    provider: 'energyzero',
    hasKey: false,
    status: 'ok',
    lastError: null,
    lastFetchedAt: Date.parse('2026-11-20T12:35:00Z'),
    contract: { kind: 'dynamic', supplierName: 'Frank Energie' },
    today: priceDay('2026-11-20', { 2: 0.2, 3: 0.2, 4: 0.2, 19: 0.4, 0: 0.35, 1: 0.35, 5: 0.35 }),
    tomorrow: priceDay('2026-11-21', { 13: 0.1, 14: 0.1, 15: 0.1, 18: 0.5 }),
    ...overrides,
  }
}

/**
 * 20 November by the hour, up to 18:00: charged 2:00 to 4:00, sun at noon,
 * discharged 17:00 and 18:00, and 64% full.
 */
export function batteryDay(): EnergyPeriod {
  const channels = {
    ...CHANNELS,
    solar: true,
    battery: true,
    batterySoc: true,
  }
  return {
    ...monthPeriod('2026-11', '2026-11-20'),
    hasHourly: true,
    channels,
    days: [day('2026-11-20', { solarKwh: 3 })],
    hours: amsterdamDayHours('2026-11-20').map((hourStart, index) => ({
      hourStart,
      hasData: index < 19,
      importKwh: 0.3,
      exportKwh: 0,
      solarKwh: index < 19 ? (index === 12 ? 0.95 : 0.1) : null,
      batteryChargeKwh: index < 19 ? (index === 2 || index === 3 ? 2.4 : 0) : null,
      batteryDischargeKwh:
        index < 19 ? (index === 17 || index === 18 ? 1.5 : 0) : null,
      consumptionKwh: 0.3,
      socPercent: index < 19 ? (index === 18 ? 64 : 30 + index * 2) : null,
    })),
  }
}

/** A month of solar and a battery, with one day's figures on `today`. */
export function solarMonth(
  overrides: Partial<Omit<EnergySolarMonth, 'assets'>> & {
    assets?: EnergyAssetRow[]
  } = {},
): EnergySolarMonth {
  return {
    siteName: 'Thuis',
    status: 'ok',
    solar: true,
    battery: true,
    batterySoc: true,
    firstDay: '2026-11-20',
    assets: [],
    days: [
      {
        day: '2026-11-20',
        producedKwh: 6,
        selfUsedKwh: 4,
        returnedKwh: 2,
        selfUsedEur: 1.2,
        consumptionKwh: 20,
        ownKwh: 6.2,
        battery: {
          chargeKwh: 4.8,
          dischargeKwh: 3,
          chargeEur: 0.96,
          dischargeEur: 1.55,
        },
        solarEur: 1.4,
        batteryEur: 0.59,
      },
    ],
    ...overrides,
  } as EnergySolarMonth
}
