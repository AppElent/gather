/**
 * How Energy figures read (APP-494): numbers, dates, channel names, chart
 * series and the sentences that say what a chart shows. Shared by the web
 * and the phone so both say the same thing in the same words (ADR-0017);
 * each draws the bars itself.
 *
 * Takes the Module's message tree and the reader's locale as trailing
 * parameters, like the other pure formatters (CODING_STANDARDS.md).
 */
import { parseIsoDate } from './civilDate'
import { formatMoney } from './finance/money'
import { fmt } from './i18n'
import type { Messages } from './messages/en'

type EnergyWords = Messages['energy']

/** A figure in the reader's language: `24.219,8` or `24,219.8`. */
export function formatEnergyNumber(
  value: number,
  locale: string,
  decimals = 1,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Euros from cents, with or without the cents. */
export function formatEnergyEuro(
  cents: number,
  locale: string,
  options: { decimals?: boolean } = {},
): string {
  return formatMoney(cents, 'EUR', locale, options)
}

export type EnergyDateStyle =
  | 'dayMonth'
  | 'dayMonthYear'
  | 'weekdayDayMonth'
  | 'month'
  | 'monthYear'
  | 'monthShort'
  | 'day'

const DATE_STYLES: Record<EnergyDateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: 'numeric', month: 'long' },
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  month: { month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  monthShort: { month: 'short' },
  day: { day: 'numeric' },
}

/** A calendar day (`YYYY-MM-DD`) or month (`YYYY-MM`) in words. */
export function formatEnergyDate(
  value: string,
  locale: string,
  style: EnergyDateStyle,
): string {
  const parts = parseIsoDate(value.length === 7 ? `${value}-01` : value)
  if (!parts) return value
  return new Intl.DateTimeFormat(locale, {
    ...DATE_STYLES[style],
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}

/** The same, capitalised, for the start of a sentence or a caption. */
export function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

/** An hour of the day as `18:00`, in Amsterdam time. */
export function formatEnergyHour(hourStart: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Amsterdam',
  }).format(new Date(hourStart))
}

type ChannelKind =
  | 'gridImport'
  | 'gridExport'
  | 'solar'
  | 'batteryCharge'
  | 'batteryDischarge'
  | 'batterySoc'
  | 'gas'

/** A channel's name: what it measures, and its tariff on a split meter. */
export function energyChannelName(
  channel: { kind: ChannelKind; tariff?: 't1' | 't2' },
  words: EnergyWords,
): string {
  const names = words.channels
  if (channel.kind === 'gridImport') {
    return channel.tariff === 't1'
      ? names.gridImportT1
      : channel.tariff === 't2'
        ? names.gridImportT2
        : names.gridImport
  }
  if (channel.kind === 'gridExport') {
    return channel.tariff === 't1'
      ? names.gridExportT1
      : channel.tariff === 't2'
        ? names.gridExportT2
        : names.gridExport
  }
  return names[channel.kind]
}

export function energyUnitName(
  unit: 'kWh' | 'm3' | 'percent',
  words: EnergyWords,
): string {
  return words.units[unit]
}

// -- Chart series ---------------------------------------------------------------

/** One slot of a mirrored chart: usage above the line, solar below it. */
export interface MirrorSlot {
  key: string
  /** Null when the slot has no figure: still to come, or not measured. */
  up: number | null
  down: number | null
  future: boolean
}

/**
 * Heights from 0 to 1 on one shared scale, as the chart grammar asks: usage
 * and solar are drawn against the same maximum. A slot still to come is a
 * dashed outline; a past slot without a figure stays empty, never a zero bar.
 */
export function mirrorHeights(slots: readonly MirrorSlot[]): {
  key: string
  up: number
  down: number
  future: boolean
  empty: boolean
}[] {
  const max = Math.max(
    0,
    ...slots.flatMap((slot) => [slot.up ?? 0, slot.down ?? 0]),
  )
  return slots.map((slot) => ({
    key: slot.key,
    up: max > 0 && slot.up !== null ? Math.max(0, slot.up) / max : 0,
    down: max > 0 && slot.down !== null ? Math.max(0, slot.down) / max : 0,
    future: slot.future,
    empty: !slot.future && slot.up === null,
  }))
}

/** The highest slot, for the sentence that says the peak. */
export function peakOf<T>(
  items: readonly T[],
  value: (item: T) => number | null,
): { item: T; value: number } | null {
  let best: { item: T; value: number } | null = null
  for (const item of items) {
    const figure = value(item)
    if (figure === null || figure <= 0) continue
    if (!best || figure > best.value) best = { item, value: figure }
  }
  return best
}

/** Twelve month pairs: last year muted, this year ink, the running one outlined. */
export function yearPairHeights(
  previous: readonly (number | null)[],
  current: readonly (number | null)[],
  runningIndex: number | null,
): { previous: number; current: number; running: boolean; hasCurrent: boolean }[] {
  const max = Math.max(
    0,
    ...previous.map((value) => value ?? 0),
    ...current.map((value) => value ?? 0),
  )
  return Array.from({ length: 12 }, (_, index) => {
    const last = previous[index] ?? null
    const now = current[index] ?? null
    return {
      previous: max > 0 && last !== null ? Math.max(0, last) / max : 0,
      current: max > 0 && now !== null ? Math.max(0, now) / max : 0,
      running: index === runningIndex,
      hasCurrent: now !== null,
    }
  })
}

/**
 * This year against last year over the months both have and that are over:
 * the running month and any month without figures on either side are left
 * out, so the comparison is like for like.
 */
export function compareYears(
  previous: readonly (number | null)[],
  current: readonly (number | null)[],
  runningIndex: number | null,
): {
  fromIndex: number
  toIndex: number
  current: number
  previous: number
  difference: number
  percent: number | null
} | null {
  const months: number[] = []
  for (let index = 0; index < 12; index++) {
    if (index === runningIndex) continue
    if (runningIndex !== null && index > runningIndex) continue
    if (previous[index] == null || current[index] == null) continue
    months.push(index)
  }
  const first = months[0]
  const last = months[months.length - 1]
  if (first === undefined || last === undefined) return null
  const sumOf = (values: readonly (number | null)[]) =>
    months.reduce((total, index) => total + (values[index] ?? 0), 0)
  const now = sumOf(current)
  const before = sumOf(previous)
  return {
    fromIndex: first,
    toIndex: last,
    current: now,
    previous: before,
    difference: now - before,
    percent: before > 0 ? Math.round(((now - before) / before) * 100) : null,
  }
}

/**
 * A difference with its sign, "+12 kWh" or "−€ 3,20", from how `format`
 * writes the size. A difference that rounds to nothing has no sign, so float
 * noise never reads as "−0".
 */
export function signedDifference(
  value: number,
  format: (size: number) => string,
): string {
  const text = format(Math.abs(value))
  if (text === format(0)) return text
  return `${value > 0 ? '+' : '−'}${text}`
}

/** "7% less than the same months in 2025", or the same in other words. */
export function yearComparisonNote(
  percent: number | null,
  previousYear: number,
  words: EnergyWords,
): string | null {
  if (percent === null) return null
  const values = { percent: Math.abs(percent), previous: previousYear }
  if (percent < 0) return fmt(words.usage.noteYearLess, values)
  if (percent > 0) return fmt(words.usage.noteYearMore, values)
  return fmt(words.usage.noteYearSame, values)
}

/** A month index (0-11) of `year` as a short month name. */
export function monthName(
  year: number,
  index: number,
  locale: string,
  style: 'month' | 'monthShort' = 'month',
): string {
  return formatEnergyDate(
    `${year}-${String(index + 1).padStart(2, '0')}`,
    locale,
    style,
  )
}
