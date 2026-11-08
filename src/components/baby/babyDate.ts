import { minutesToClock } from '@gather/core/civil-date'

// `<input type="datetime-local">` renders unpredictably wide on mobile
// Safari (the combined widget doesn't respect its container's width),
// overflowing its card — so date and time are separate `type="date"` /
// `type="time"` inputs instead, combined via these helpers.

/** `<input type="time">` value (local time) from epoch ms. */
export function toTimeInputValue(ms: number): string {
  const d = new Date(ms)
  return minutesToClock(d.getHours() * 60 + d.getMinutes())
}

/** Combine a `type="date"` value and a `type="time"` value (local time) into epoch ms. */
export function combineDateTime(dateStr: string, timeStr: string): number {
  return new Date(`${dateStr}T${timeStr || '00:00'}`).getTime()
}

export function formatEventTimestamp(ms: number, locale: string): string {
  return new Date(ms).toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEventDateHeading(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
