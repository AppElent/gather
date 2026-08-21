import { useEffect, useState } from 'react'

/** The delay to the next whole minute, never a zero-length timer. */
export function millisecondsUntilNextMinute(now: number): number {
  const remainder = now % 60_000
  return remainder === 0 ? 60_000 : 60_000 - remainder
}

/**
 * A clock for summaries whose wording changes as time passes.
 *
 * The initial value is captured once, then refreshed on each minute boundary
 * while the screen is mounted. Rendering reads state rather than the wall
 * clock, which keeps the render pure and lets React own the timer lifecycle.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const current = Date.now()
      setNow(current)
      timer = setTimeout(tick, millisecondsUntilNextMinute(current))
    }
    timer = setTimeout(tick, millisecondsUntilNextMinute(now))
    return () => clearTimeout(timer)
  }, [now])

  return now
}
