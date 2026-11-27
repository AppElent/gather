import { todayIn } from '@gather/core/civil-date'
import { useCallback, useSyncExternalStore } from 'react'

function everyMinute(onChange: () => void) {
  const timer = setInterval(onChange, 60_000)
  return () => clearInterval(timer)
}

/**
 * The calendar day in a zone, moving on at its midnight while the page stays
 * open (APP-991), as the phone's `useGroupToday`. Checked each minute; a
 * component re-renders only when the day itself changes.
 */
export function useDayIn(timeZone: string | undefined): string {
  const today = useCallback(() => todayIn(timeZone), [timeZone])
  return useSyncExternalStore(everyMinute, today, today)
}
