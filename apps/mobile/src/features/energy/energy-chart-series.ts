/**
 * The series Energy's charts draw (APP-494), from what `energyUsage.day` and
 * `energyUsage.month` return. Pure, so the screens stay about layout and a
 * test can hold the rules: a slot still to come is `future`, a past slot
 * without a figure has `null`, never zero (designs/energy, section 11).
 */
import { amsterdamDayHours } from '@gather/core/energy'
import type { MirrorSlot } from '@gather/core/energy-present'

export interface EnergyHourRow {
  hourStart: number
  hasData: boolean
  importKwh: number
  exportKwh: number
  solarKwh: number | null
  consumptionKwh: number
  socPercent: number | null
}

export interface EnergyDayRow {
  day: string
  hasData: boolean
  estimated: boolean
  importKwh: number
  exportKwh: number
  solarKwh: number | null
  consumptionKwh: number
}

/** What an hour used, by the same rule as a day (battery included). */
export function hourUsageKwh(hour: EnergyHourRow): number {
  return Math.max(0, hour.consumptionKwh)
}

/** Every hour of `day`, with the hours after `now` still to come. */
export function hourSlots(
  day: string,
  hours: readonly EnergyHourRow[],
  now: number,
  withSolar: boolean,
): (MirrorSlot & { hourStart: number })[] {
  const byStart = new Map(hours.map((hour) => [hour.hourStart, hour]))
  return amsterdamDayHours(day).map((hourStart) => {
    const hour = byStart.get(hourStart)
    const future = hourStart > now
    const known = !future && hour?.hasData
    return {
      key: String(hourStart),
      hourStart,
      future,
      up: known && hour ? hourUsageKwh(hour) : null,
      down: known && hour && withSolar ? hour.solarKwh : null,
    }
  })
}

/** Every day of a month, with the days after `today` still to come. */
export function daySlots(
  days: readonly EnergyDayRow[],
  today: string,
  withSolar: boolean,
): (MirrorSlot & { day: string })[] {
  return days.map((day) => ({
    key: day.day,
    day: day.day,
    future: day.day > today,
    up: day.hasData ? day.consumptionKwh : null,
    down: day.hasData && withSolar ? day.solarKwh : null,
  }))
}
