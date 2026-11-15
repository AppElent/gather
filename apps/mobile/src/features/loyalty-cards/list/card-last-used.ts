import { fmt, plural } from '@gather/core/i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Home's activity words, which the list reuses for "when". */
export interface WhenWords {
  justNow: string
  minutesAgo: { one: string; other: string }
  hoursAgo: { one: string; other: string }
  yesterday: string
  daysAgo: string
}

/**
 * When a card was last shown, as the web's list says it
 * (`formatActivityTime`): relative up to a week, then a date. Hermes has no
 * `Intl.RelativeTimeFormat`, so the words come from the message tree. A time
 * a little in the future, from a skewed clock, reads as just now.
 */
export function cardLastUsed(
  at: number,
  words: WhenWords,
  locale: string,
  now: number = Date.now(),
): string {
  const elapsed = now - at
  if (elapsed < MINUTE) return words.justNow
  if (elapsed < HOUR) {
    return plural(locale, Math.floor(elapsed / MINUTE), words.minutesAgo)
  }
  if (elapsed < DAY) {
    return plural(locale, Math.floor(elapsed / HOUR), words.hoursAgo)
  }
  const days = Math.floor(elapsed / DAY)
  if (days === 1) return words.yesterday
  if (days < 7) return fmt(words.daysAgo, { count: days })
  return new Date(at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
