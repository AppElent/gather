import { localIsoDate } from '@gather/core/civil-date'

/**
 * When a note was last touched, in the app's language.
 *
 * Today gets a clock, everything else gets a date, and nothing gets "3 hours
 * ago": Hermes ships no `Intl.RelativeTimeFormat` (see `src/i18n/index.tsx`),
 * and hand-rolling one in two languages to say something a timestamp already
 * says is not worth the strings.
 */
export function noteWhen(
  updatedAt: number,
  locale: string,
  todayWord: string,
): string {
  const when = new Date(updatedAt)
  if (localIsoDate(when) === localIsoDate()) {
    return `${todayWord} ${when.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  return when.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

/** The first line with anything on it, which is what a preview is. */
export function preview(body: string): string {
  return (
    body
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ''
  )
}
