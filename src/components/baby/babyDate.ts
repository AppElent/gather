import { clockTime } from '@gather/core/home-today'
import { clockMoment } from '@gather/core/task-reminders'
import { runtimeTimeZone } from '@gather/core/time-zones'

// `<input type="datetime-local">` renders unpredictably wide on mobile
// Safari (the combined widget doesn't respect its container's width),
// overflowing its card — so date and time are separate `type="date"` /
// `type="time"` inputs instead, combined via these helpers.

function resolvedZone(timeZone: string | undefined): string | undefined {
  return timeZone ? (runtimeTimeZone(timeZone) ?? undefined) : undefined
}

/** `<input type="time">` value from epoch ms, in `timeZone` or local time. */
export function toTimeInputValue(ms: number, timeZone?: string): string {
  return clockTime(ms, timeZone)
}

/** Combine a `type="date"` value and a `type="time"` value into epoch ms. */
export function combineDateTime(
  dateStr: string,
  timeStr: string,
  timeZone?: string,
): number {
  const zone = resolvedZone(timeZone)
  if (zone) {
    const moment = clockMoment({
      date: dateStr,
      time: timeStr || '00:00',
      timeZone: zone,
    })
    if (moment !== null) return moment
  }
  return new Date(`${dateStr}T${timeStr || '00:00'}`).getTime()
}

export function formatEventTimestamp(
  ms: number,
  locale: string,
  timeZone?: string,
): string {
  const zone = resolvedZone(timeZone)
  return new Date(ms).toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(zone ? { timeZone: zone } : {}),
  })
}

export function formatEventDateHeading(
  ms: number,
  locale: string,
  timeZone?: string,
): string {
  const zone = resolvedZone(timeZone)
  return new Date(ms).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...(zone ? { timeZone: zone } : {}),
  })
}
