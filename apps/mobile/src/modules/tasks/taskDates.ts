/**
 * What Tasks means by a date: the weekend shortcut and how a due date reads.
 * The date arithmetic itself is `@gather/core/civil-date`.
 */
import { addDays, daysBetween, localMidnight } from '@gather/core/civil-date'

/**
 * The coming Saturday — and today, if today *is* Saturday.
 *
 * Sunday counts as still being the weekend rather than as six days early: a
 * person tapping "This weekend" on a Sunday means today, not next week.
 */
export function weekendFrom(iso: string): string {
  const weekday = localMidnight(iso).getDay()
  if (weekday === 0 || weekday === 6) return iso
  return addDays(iso, 6 - weekday)
}

export function isOverdue(due: string, today: string): boolean {
  return daysBetween(today, due) < 0
}

/**
 * How a due date reads on a row.
 *
 * Near dates get a word or a weekday, because "Thu" is something a person can
 * act on and "2026-08-27" is something they have to work out. Anything beyond
 * a week gets the actual date — by then the weekday has stopped being useful
 * and started being ambiguous about which Thursday it means.
 *
 * The locale is the *app's*, not the device's: this app has its own language
 * toggle, and a screen that mixes the two reads as a bug (ADR-0011).
 */
export function dueLabel(
  due: string,
  today: string,
  locale: string,
  words: { today: string; tomorrow: string },
): string {
  const offset = daysBetween(today, due)
  if (offset === 0) return words.today
  if (offset === 1) return words.tomorrow
  if (offset > 1 && offset < 7) {
    return localMidnight(due).toLocaleDateString(locale, { weekday: 'short' })
  }
  return localMidnight(due).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}
