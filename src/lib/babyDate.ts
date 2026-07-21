const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole months between `birth` and `now` (0 if `now` is before `birth`). */
function monthsBetween(birth: Date, now: Date): number {
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months--
  return Math.max(0, months)
}

/** Age as of `atMs` (defaults to now), e.g. "5 days old", "3 months old". */
export function formatAge(
  birthDate: string,
  atMs: number = Date.now(),
): string {
  const birth = new Date(`${birthDate}T00:00:00`)
  const now = new Date(atMs)
  const days = Math.max(0, Math.floor((atMs - birth.getTime()) / MS_PER_DAY))
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`
  if (days < 60) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} old`
  }
  const months = monthsBetween(birth, now)
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} old`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths === 0
    ? `${years} year${years === 1 ? '' : 's'} old`
    : `${years}y ${remMonths}m old`
}

/** `<input type="datetime-local">` value (local time, no timezone) from epoch ms. */
export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Inverse of toDatetimeLocalValue: local datetime-local string to epoch ms. */
export function fromDatetimeLocalValue(value: string): number {
  return new Date(value).getTime()
}

export function formatEventTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEventDateHeading(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function dayKey(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Start-of-day epoch ms for a local `YYYY-MM-DD` date string. */
export function startOfDayMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getTime()
}

/** End-of-day (23:59:59.999) epoch ms for a local `YYYY-MM-DD` date string. */
export function endOfDayMs(dateStr: string): number {
  return new Date(`${dateStr}T23:59:59.999`).getTime()
}
