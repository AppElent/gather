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
