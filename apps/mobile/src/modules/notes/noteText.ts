import { dayIn, todayIn } from '@gather/core/civil-date'
import { runtimeTimeZone } from '@gather/core/time-zones'

/**
 * When a note was last touched, in the app's language.
 *
 * Today gets a clock, everything else gets a date, and nothing gets "3 hours
 * ago": Hermes ships no `Intl.RelativeTimeFormat` (see `src/i18n/index.tsx`),
 * and hand-rolling one in two languages to say something a timestamp already
 * says is not worth the strings. When the Group has a time zone, both the
 * "today" test and the formatted time/date read in that zone.
 */
export function noteWhen(
  updatedAt: number,
  locale: string,
  todayWord: string,
  timeZone?: string,
): string {
  const when = new Date(updatedAt)
  const today = dayIn(timeZone)(updatedAt) === todayIn(timeZone)
  const resolved = timeZone
    ? (runtimeTimeZone(timeZone) ?? undefined)
    : undefined
  const format = (zone: string | undefined) =>
    today
      ? `${todayWord} ${when.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          ...(zone ? { timeZone: zone } : {}),
        })}`
      : when.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          ...(zone ? { timeZone: zone } : {}),
        })
  try {
    return format(resolved)
  } catch {
    return format(undefined)
  }
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

export interface NoteText {
  title: string
  body: string
}

/** The fields of a draft that say something else than the saved note. */
export function unsavedText(
  saved: NoteText,
  draft: Partial<NoteText>,
): Partial<NoteText> {
  return {
    ...(draft.title !== undefined && draft.title !== saved.title
      ? { title: draft.title }
      : {}),
    ...(draft.body !== undefined && draft.body !== saved.body
      ? { body: draft.body }
      : {}),
  }
}
