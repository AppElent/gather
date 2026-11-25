import { useEffect, useState } from 'react'

const HOUR_MS = 60 * 60_000

const hourOf = (now: number) => now - (now % HOUR_MS)

/**
 * The start of the current hour, moving on while mounted, as on the phone: a
 * Group's browsers ask the server the same question within the hour.
 */
export function useHourClock(): number {
  const [hour, setHour] = useState(() => hourOf(Date.now()))
  useEffect(() => {
    const timer = setTimeout(
      () => setHour(hourOf(Date.now())),
      hour + HOUR_MS - Date.now(),
    )
    return () => clearTimeout(timer)
  }, [hour])
  return hour
}
