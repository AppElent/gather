/**
 * What each Energy chart says in words (designs/energy, section 11): the
 * label VoiceOver reads for the figure and the sentence under it for
 * everyone. Peak and total, never a description of the bars.
 */
import {
  formatEnergyDate,
  formatEnergyHour,
  formatEnergyNumber,
  type MirrorSlot,
  peakOf,
} from '@gather/core/energy-present'
import { fmt } from '@gather/core/i18n'
import type { Messages } from '@gather/core/messages'

type EnergyWords = Messages['energy']

/** The axis under an hour chart. */
export const HOUR_TICKS = ['00', '06', '12', '18', '24'] as const

/** The axis under a chart of a month's days. */
export function dayTicks(count: number): string[] {
  return ['1', '10', '20', String(count)]
}

/** "Usage per hour on 20 November. Usage highest at 18:00, …". */
export function hourChartSentence(
  slots: readonly (MirrorSlot & { hourStart: number })[],
  day: string,
  words: EnergyWords,
  locale: string,
): string {
  const used = peakOf(slots, (slot) => slot.up)
  if (!used) return words.usage.chartEmpty
  const solar = peakOf(slots, (slot) => slot.down)
  const sentence = fmt(words.usage.hourLabel, {
    date: formatEnergyDate(day, locale, 'dayMonth'),
    hour: formatEnergyHour(used.item.hourStart, locale),
    kwh: formatEnergyNumber(used.value, locale, 2),
  })
  return solar
    ? sentence +
        fmt(words.usage.hourLabelSolar, {
          hour: formatEnergyHour(solar.item.hourStart, locale),
          kwh: formatEnergyNumber(solar.value, locale, 2),
        })
    : sentence
}

/** "Usage per day in November. Most usage on 12 November, …". */
export function dayChartSentence(
  slots: readonly (MirrorSlot & { day: string })[],
  month: string,
  words: EnergyWords,
  locale: string,
): string {
  const used = peakOf(slots, (slot) => slot.up)
  if (!used) return words.usage.chartEmpty
  const solar = peakOf(slots, (slot) => slot.down)
  const sentence = fmt(words.usage.dayLabel, {
    month: formatEnergyDate(month, locale, 'month'),
    day: formatEnergyDate(used.item.day, locale, 'dayMonth'),
    kwh: formatEnergyNumber(used.value, locale, 1),
  })
  return solar
    ? sentence +
        fmt(words.usage.dayLabelSolar, {
          day: formatEnergyDate(solar.item.day, locale, 'dayMonth'),
          kwh: formatEnergyNumber(solar.value, locale, 1),
        })
    : sentence
}
