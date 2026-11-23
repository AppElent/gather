import {
  formatEnergyDate,
  formatEnergyHour,
  formatEnergyNumber,
  mirrorHeights,
  peakOf,
} from '@gather/core/energy-present'
import { fmt, type Messages } from '../../lib/i18n'
import type { EnergyPeriod } from './energyShared'

/**
 * The mirrored usage-and-solar series of the Energy charts (APP-494), with
 * the sentence that says what each one shows.
 */

type Hour = EnergyPeriod['hours'][number]

/** What an hour used, by the same rule as a day (battery included). */
export function hourUsageKwh(hour: Hour, _hasSolar?: boolean): number {
  return Math.max(0, hour.consumptionKwh)
}

export function hourSeries(
  period: EnergyPeriod,
  now: number,
  messages: Messages,
  locale: string,
) {
  const words = messages.energy.usage
  const hasSolar = period.channels.solar
  const hours = period.hours
  const slots = mirrorHeights(
    hours.map((hour) => ({
      key: String(hour.hourStart),
      up: hour.hasData ? hourUsageKwh(hour, hasSolar) : null,
      down: hour.hasData && hasSolar ? hour.solarKwh : null,
      future: !hour.hasData && hour.hourStart > now,
    })),
  )
  const withData = hours.filter((hour) => hour.hasData)
  const peak = peakOf(withData, (hour) => hourUsageKwh(hour, hasSolar))
  const solarPeak = hasSolar ? peakOf(withData, (hour) => hour.solarKwh) : null
  const day = period.days[0]?.day
  const label =
    peak && day
      ? fmt(words.hourLabel, {
          date: formatEnergyDate(day, locale, 'dayMonth'),
          hour: formatEnergyHour(peak.item.hourStart, locale),
          kwh: formatEnergyNumber(peak.value, locale),
        }) +
        (solarPeak
          ? fmt(words.hourLabelSolar, {
              hour: formatEnergyHour(solarPeak.item.hourStart, locale),
              kwh: formatEnergyNumber(solarPeak.value, locale),
            })
          : '')
      : words.chartEmpty
  return { slots, label }
}

export function daySeries(
  period: EnergyPeriod,
  today: string,
  messages: Messages,
  locale: string,
) {
  const words = messages.energy.usage
  const hasSolar = period.channels.solar
  const slots = mirrorHeights(
    period.days.map((day) => ({
      key: day.day,
      up: day.hasData ? day.consumptionKwh : null,
      down: day.hasData && hasSolar ? day.solarKwh : null,
      future: day.day > today,
    })),
  )
  const withData = period.days.filter((day) => day.hasData)
  const peak = peakOf(withData, (day) => day.consumptionKwh)
  const solarPeak = hasSolar ? peakOf(withData, (day) => day.solarKwh) : null
  const month = period.days[0]?.day.slice(0, 7)
  const label =
    peak && month
      ? fmt(words.dayLabel, {
          month: formatEnergyDate(month, locale, 'month'),
          day: formatEnergyDate(peak.item.day, locale, 'dayMonth'),
          kwh: formatEnergyNumber(peak.value, locale),
        }) +
        (solarPeak
          ? fmt(words.dayLabelSolar, {
              day: formatEnergyDate(solarPeak.item.day, locale, 'dayMonth'),
              kwh: formatEnergyNumber(solarPeak.value, locale),
            })
          : '')
      : words.chartEmpty
  return { slots, label }
}

/** Axis ticks under a month of days: 1, 10, 20 and the last day. */
export function dayTicks(count: number): string[] {
  return ['1', '10', '20', String(count)]
}

export const HOUR_TICKS = ['00', '06', '12', '18', '24'] as const
