import { dayIn, todayIn } from '@gather/core/civil-date'

/**
 * When a note was last touched, as the phone says it (`noteWhen` in
 * `apps/mobile/src/modules/notes/noteText.ts`): a clock today, a date before.
 * The day and the clock are the Group's.
 */
export function noteWhen(
  updatedAt: number,
  locale: string,
  todayWord: string,
  timeZone?: string,
): string {
  const when = new Date(updatedAt)
  const today = dayIn(timeZone)(updatedAt) === todayIn(timeZone)
  const format = (zone: string | undefined) =>
    today
      ? `${todayWord} ${when.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: zone,
        })}`
      : when.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          timeZone: zone,
        })
  try {
    return format(timeZone)
  } catch {
    // A zone this browser does not know: its own calendar, as `dayIn` does.
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
