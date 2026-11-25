/**
 * How solar and battery figures read (APP-496): facts, chart bars, the
 * sentence under each chart, and payback. Shared by the web and the phone
 * (ADR-0017); each draws the bars itself.
 */
import {
  distinctPeakOf,
  formatEnergyDate,
  formatEnergyEuro,
  formatEnergyHour,
  formatEnergyNumber,
} from './energyPresent'
import { energyHourLabel, formatEnergyPrice } from './energyPricePresent'
import {
  type EnergyAssetTerms,
  type EnergyBatteryMode,
  type EnergyPayback,
  type EnergySolarDay,
  type EnergySolarTotals,
  energyBatteryModes,
  energyModeRuns,
  energySelfSufficiency,
  energySolarTotals,
} from './energySolar'
import { amsterdamDayOf, energyMonthDays } from './energyUsage'
import { fmt, plural } from './i18n'
import type { Messages } from './messages/en'

type EnergyWords = Messages['energy']

const HOUR_MS = 3_600_000

/** What of an hour these charts draw, as `energyUsage.day` returns it. */
export interface EnergySolarChartHour {
  hourStart: number
  solarKwh: number | null
  batteryChargeKwh: number | null
  batteryDischargeKwh: number | null
  socPercent: number | null
}

const kwhText = (value: number, words: EnergyWords, locale: string) =>
  `${formatEnergyNumber(value, locale)} ${words.units.kWh}`

/** A whole percent, so a bar, its sentence and its fact round the same way. */
const percentText = (value: number) => String(Math.round(value))

/** A size without needless decimals: "10", "10,24", "4.200". */
const sizeText = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

// -- Assets ------------------------------------------------------------------------

/** "4.200 Wp · sinds maart 2023", or what of it is known. */
export function energyAssetSpec(
  asset: EnergyAssetTerms,
  words: EnergyWords,
  locale: string,
): string {
  const copy = words.solar
  const parts = [
    asset.kind === 'solar'
      ? asset.peakWatt !== undefined
        ? fmt(copy.peakWatt, { size: sizeText(asset.peakWatt, locale) })
        : copy.kindSolar
      : asset.capacityKwh !== undefined
        ? fmt(copy.capacity, { size: sizeText(asset.capacityKwh, locale) })
        : copy.kindBattery,
    ...(asset.installedOn
      ? [
          fmt(copy.since, {
            month: formatEnergyDate(asset.installedOn, locale, 'monthYear'),
          }),
        ]
      : []),
  ]
  return parts.join(' · ')
}

/** All the sizes of one kind together; null while one is missing. */
export function energyAssetTotal(
  assets: readonly EnergyAssetTerms[],
  kind: EnergyAssetTerms['kind'],
): number | null {
  const sizes = assets
    .filter((asset) => asset.kind === kind)
    .map((asset) => (kind === 'solar' ? asset.peakWatt : asset.capacityKwh))
  if (sizes.length === 0) return null
  let total = 0
  for (const size of sizes) {
    if (size === undefined) return null
    total += size
  }
  return total
}

/** The header's second line: "4.200 Wp zon · 10 kWh batterij". */
export function energyAssetsLine(
  assets: readonly EnergyAssetTerms[],
  words: EnergyWords,
  locale: string,
): string | null {
  const watt = energyAssetTotal(assets, 'solar')
  const capacity = energyAssetTotal(assets, 'battery')
  const parts = [
    watt === null
      ? null
      : fmt(words.solar.headSolar, { size: sizeText(watt, locale) }),
    capacity === null
      ? null
      : fmt(words.solar.headBattery, { size: sizeText(capacity, locale) }),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

// -- Sun -------------------------------------------------------------------------------

export interface EnergySolarCard {
  facts: { key: string; label: string; value: string; unit: string }[]
  /** Of what was produced, 0 to 1; null leaves the bar out. */
  selfShare: number | null
  barLabel: string | null
  sentence: string | null
}

/** The Sun card; null without a figure in the period. */
export function energySolarCard(
  totals: EnergySolarTotals,
  range: 'today' | 'month',
  hasBattery: boolean,
  words: EnergyWords,
  locale: string,
): EnergySolarCard | null {
  if (totals.producedKwh === null) return null
  const copy = words.solar
  const number = (value: number) => formatEnergyNumber(value, locale)
  const self = totals.selfUsedPercent
  const facts = [
    {
      key: 'produced',
      label: copy.produced,
      value: number(totals.producedKwh),
      unit: words.units.kWh,
    },
    ...(totals.selfUsedKwh === null
      ? []
      : [
          {
            key: 'self',
            label: copy.selfUsed,
            value: number(totals.selfUsedKwh),
            unit:
              self === null
                ? words.units.kWh
                : fmt(copy.kwhPercent, { percent: percentText(self) }),
          },
        ]),
    ...(totals.returnedKwh === null
      ? []
      : [
          {
            key: 'returned',
            label: copy.returned,
            value: number(totals.returnedKwh),
            unit: words.units.kWh,
          },
        ]),
  ]
  const sentence =
    totals.selfSufficiency === null
      ? null
      : fmt(
          range === 'today'
            ? hasBattery
              ? copy.ownToday
              : copy.ownTodayRoof
            : hasBattery
              ? copy.ownMonth
              : copy.ownMonthRoof,
          { percent: percentText(totals.selfSufficiency) },
        )
  return {
    facts,
    selfShare: self === null ? null : self / 100,
    barLabel:
      self === null
        ? null
        : fmt(copy.barLabel, {
            self: percentText(self),
            back: String(100 - Math.round(self)),
          }),
    sentence,
  }
}

export interface EnergySolarBar {
  key: string
  /** 0 to 1 of the highest. */
  height: number
  future: boolean
}

/** "Generated per hour" of a day. */
export function energySolarHourChart(
  hours: readonly EnergySolarChartHour[],
  now: number,
  words: EnergyWords,
  locale: string,
): { bars: EnergySolarBar[]; sentence: string } | null {
  const max = Math.max(0, ...hours.map((hour) => hour.solarKwh ?? 0))
  if (!hours.some((hour) => hour.solarKwh !== null)) return null
  const peak = distinctPeakOf(hours, (hour) => hour.solarKwh, 0.005)
  return {
    bars: hours.map((hour) => ({
      key: String(hour.hourStart),
      height: max > 0 ? (hour.solarKwh ?? 0) / max : 0,
      future: hour.solarKwh === null && hour.hourStart > now,
    })),
    sentence: peak
      ? fmt(words.solar.hourPeak, {
          hour: formatEnergyHour(peak.item.hourStart, locale),
          kwh: formatEnergyNumber(peak.value, locale, 2),
        })
      : words.solar.hourNone,
  }
}

/** "Self-sufficiency per day" of a month, with its average. */
export function energySelfSufficiencyChart(
  days: readonly EnergySolarDay[],
  month: string,
  today: string,
  words: EnergyWords,
  locale: string,
): { bars: EnergySolarBar[]; average: number; sentence: string } | null {
  const average = energySolarTotals(days).selfSufficiency
  if (average === null) return null
  const byDay = new Map(
    days.map((day) => [day.day, energySelfSufficiency(day)] as const),
  )
  const all = energyMonthDays(month)
  // Days within half a percent read the same, so none of them is the best.
  const best = distinctPeakOf(all, (day) => byDay.get(day) ?? null, 0.5)
  return {
    bars: all.map((day) => ({
      key: day,
      height: (byDay.get(day) ?? 0) / 100,
      future: day > today,
    })),
    average: average / 100,
    sentence: best
      ? fmt(words.solar.dayBest, {
          percent: percentText(average),
          day: formatEnergyDate(best.item, locale, 'dayMonth'),
          best: percentText(best.value),
        })
      : fmt(words.solar.dayAverage, { percent: percentText(average) }),
  }
}

// -- Battery -----------------------------------------------------------------------------

/** The latest measured state of charge of a day, or null. */
export function energySocNow(
  hours: readonly Pick<EnergySolarChartHour, 'socPercent'>[],
): number | null {
  for (let index = hours.length - 1; index >= 0; index--) {
    const percent = hours[index]?.socPercent
    if (percent !== null && percent !== undefined) {
      return Math.min(100, Math.max(0, percent))
    }
  }
  return null
}

export interface EnergyBatteryCard {
  rows: { key: string; label: string; value: string; strong: boolean }[]
  /** Why the value is not known, or not whole. */
  note: string | null
  /** How the value is counted; only with a value. */
  footnote: string | null
}

/** The Battery card's rows; null without a figure in the period. */
export function energyBatteryCard(
  totals: EnergySolarTotals,
  words: EnergyWords,
  locale: string,
): EnergyBatteryCard | null {
  const { battery } = totals
  if (!battery) return null
  const copy = words.solar
  const line = (kwh: number, price: number | null) =>
    price === null
      ? kwhText(kwh, words, locale)
      : fmt(copy.kwhAverage, {
          kwh: formatEnergyNumber(kwh, locale),
          price: formatEnergyPrice(price, locale),
        })
  return {
    rows: [
      {
        key: 'charged',
        label: copy.charged,
        value: line(battery.chargeKwh, battery.chargePrice),
        strong: false,
      },
      {
        key: 'discharged',
        label: copy.discharged,
        value: line(battery.dischargeKwh, battery.dischargePrice),
        strong: false,
      },
      {
        key: 'value',
        label: copy.value,
        value:
          battery.valueEur === null
            ? copy.valueUnknown
            : formatEnergyPrice(battery.valueEur, locale),
        strong: true,
      },
    ],
    note:
      battery.unpricedDays === 0
        ? null
        : battery.valueEur === null
          ? copy.valueWhyUnknown
          : plural(locale, battery.unpricedDays, copy.unpricedDays),
    footnote: battery.valueEur === null ? null : copy.valueFootnote,
  }
}

/** "6,4 van 10 kWh"; null without a capacity. */
export function energyStoredLine(
  socPercent: number | null,
  capacityKwh: number | null,
  words: EnergyWords,
  locale: string,
): string | null {
  if (socPercent === null || capacityKwh === null) return null
  return fmt(words.solar.stored, {
    kwh: formatEnergyNumber((socPercent / 100) * capacityKwh, locale),
    capacity: sizeText(capacityKwh, locale),
  })
}

export interface EnergyBatteryStrip {
  cells: { key: string; mode: EnergyBatteryMode }[]
  sentence: string | null
}

/** The strip under a state of charge, with what it shows in words. */
export function energyBatteryStrip(
  hours: readonly EnergySolarChartHour[],
  now: number,
  words: EnergyWords,
  locale: string,
): EnergyBatteryStrip | null {
  const modes = energyBatteryModes(hours, now)
  if (!modes.some((mode) => mode !== 'future' && mode !== 'unknown')) return null
  const first = hours[0]
  const day = first ? amsterdamDayOf(first.hourStart) : ''
  // The two longest stretches say the day; every hour would not be read.
  // Joined by hand: the phone's engine has no `Intl.ListFormat`.
  const windows = (mode: EnergyBatteryMode) => {
    const [first = '', second] = energyModeRuns(modes, mode)
      .sort((a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from)
      .slice(0, 2)
      .sort((a, b) => a.from - b.from)
      .map(({ from, to }) =>
        fmt(words.solar.window, {
          from: energyHourLabel(hours[from]?.hourStart ?? 0, day, locale),
          to: energyHourLabel(
            (hours[to - 1]?.hourStart ?? 0) + HOUR_MS,
            day,
            locale,
          ),
        }),
      )
    return second ? fmt(words.solar.windowPair, { first, second }) : first
  }
  const charge = windows('charging')
  const discharge = windows('discharging')
  return {
    cells: hours.map((hour, index) => ({
      key: String(hour.hourStart),
      mode: modes[index] ?? 'unknown',
    })),
    sentence:
      charge && discharge
        ? fmt(words.solar.stripBoth, { charge, discharge })
        : charge
          ? fmt(words.solar.stripCharge, { charge })
          : discharge
            ? fmt(words.solar.stripDischarge, { discharge })
            : words.solar.stripIdle,
  }
}

// -- Payback -----------------------------------------------------------------------------

/** One asset's payback in words. `null` from the sum means no figure yet. */
export function energyPaybackText(
  asset: EnergyAssetTerms,
  payback: EnergyPayback | null,
  words: EnergyWords,
  locale: string,
): {
  /** 0 to 1. */
  share: number
  amount: string
  rest: string
  notes: string[]
} | null {
  if (asset.purchaseCents === undefined) return null
  const copy = words.solar
  const euro = (cents: number) =>
    formatEnergyEuro(cents, locale, { decimals: false })
  const price = euro(asset.purchaseCents)
  if (!payback) {
    return {
      share: 0,
      amount: '',
      rest: fmt(copy.paybackNone, { price }),
      notes: [],
    }
  }
  const counted =
    asset.installedOn === undefined || payback.since > asset.installedOn
      ? fmt(copy.paybackSince, {
          month: formatEnergyDate(payback.since, locale, 'monthYear'),
        })
      : null
  return {
    share: Math.min(1, Math.max(0, payback.earnedCents / payback.purchaseCents)),
    amount: euro(payback.earnedCents),
    rest: fmt(copy.paybackOf, { price }),
    notes: [
      ...(counted ? [counted] : []),
      ...(payback.missingDays > 0
        ? [plural(locale, payback.missingDays, copy.paybackMissing)]
        : []),
    ],
  }
}

// -- Home ----------------------------------------------------------------------------------

/** Home's battery card: what it does now, how full it is, what it earned. */
export function energyHomeBattery(
  hours: readonly EnergySolarChartHour[],
  today: EnergySolarDay | undefined,
  now: number,
  words: EnergyWords,
  locale: string,
): { state: string | null; percent: number | null; value: string | null; label: string } {
  const copy = words.solar
  // An hour or two is how far behind Home Assistant runs; older is not "now".
  const latest = hours
    .filter(
      (hour) =>
        hour.hourStart <= now &&
        now - hour.hourStart <= 3 * HOUR_MS &&
        (hour.batteryChargeKwh !== null || hour.batteryDischargeKwh !== null),
    )
    .pop()
  const mode = latest ? energyBatteryModes([latest], now)[0] : undefined
  const net = latest
    ? (latest.batteryDischargeKwh ?? 0) - (latest.batteryChargeKwh ?? 0)
    : 0
  const state =
    latest && mode
      ? fmt(
          mode === 'charging'
            ? copy.homeCharging
            : mode === 'discharging'
              ? copy.homeDischarging
              : copy.homeIdle,
          {
            hour: formatEnergyHour(latest.hourStart, locale),
            kw: formatEnergyNumber(Math.abs(net), locale),
          },
        )
      : null
  const percent = energySocNow(hours)
  const battery = today?.battery
  const eur =
    battery && battery.chargeEur !== null && battery.dischargeEur !== null
      ? battery.dischargeEur - battery.chargeEur
      : null
  const value =
    eur === null
      ? null
      : fmt(eur > 0 ? copy.homeValue : copy.homeValuePlain, {
          amount: formatEnergyPrice(eur, locale),
        })
  return {
    state,
    percent,
    value,
    label: [
      copy.homeBattery,
      state,
      percent === null ? null : fmt(copy.homeSoc, { percent: percentText(percent) }),
      value,
    ]
      .filter(Boolean)
      .join('. '),
  }
}

/** Home's row: "Self-sufficiency this month 31%". */
export function energySolarRowSub(
  days: readonly EnergySolarDay[],
  words: EnergyWords,
): string {
  const percent = energySolarTotals(days).selfSufficiency
  return percent === null
    ? words.solar.rowSub
    : fmt(words.solar.rowSubPercent, { percent: percentText(percent) })
}
