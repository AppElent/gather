import type { CalendarEvent } from '@gather/core/calendar'

/**
 * Merges the events every month source reported into one list. Sources of a
 * calendar that no longer exists are dropped: an unmounted source cannot clear
 * what it reported, so a deleted calendar's events would otherwise stay until
 * relaunch. When two sources report the same event, the newest revision wins.
 */
export function mergeSourceEvents(
  sourceEvents: Record<string, CalendarEvent[]>,
  liveCalendarIds: Iterable<string>,
): CalendarEvent[] {
  const live = new Set(liveCalendarIds)
  const byId = new Map<string, CalendarEvent>()
  for (const events of Object.values(sourceEvents)) {
    for (const event of events) {
      if (!live.has(event.calendarId)) continue
      const previous = byId.get(event.id)
      if (!previous || event.revision >= previous.revision)
        byId.set(event.id, event)
    }
  }
  return [...byId.values()]
}

/** One calendar's events for one month: `<calendarId>:<month's first day>`. */
export function calendarSourceKey(calendarId: string, month: string): string {
  return `${calendarId}:${month}`
}

/**
 * A source's report, kept only once its month is complete. Until then the
 * last complete report stays (a month scrolled back into reach keeps showing
 * its events while they reload), and a month never reported stays unknown
 * rather than reading as empty.
 */
export function applySourceReport(
  current: Record<string, CalendarEvent[]>,
  sourceKey: string,
  events: CalendarEvent[],
  complete: boolean,
): Record<string, CalendarEvent[]> {
  if (!complete) return current
  return { ...current, [sourceKey]: events }
}

/**
 * Whether every calendar has reported `month` complete, so a day without
 * events in it really has none. With no calendars there is nothing to wait
 * for; while the calendars themselves load, nothing is known yet.
 */
export function isMonthLoaded(
  reported: Record<string, unknown>,
  calendarIds: readonly string[] | null,
  month: string,
): boolean {
  if (calendarIds === null) return false
  return calendarIds.every((id) => calendarSourceKey(id, month) in reported)
}
