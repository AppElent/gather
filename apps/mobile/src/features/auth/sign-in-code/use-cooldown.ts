/**
 * A countdown for "send a new code": `start()` arms it, `remaining` counts
 * whole seconds down to 0. Clerk rate-limits sends, so the control is held back
 * for a moment rather than inviting a second request straight away. The same
 * hook as the web's `src/lib/auth/useCooldown.ts`; React Native has no shared
 * home for it.
 */
import { useCallback, useEffect, useState } from 'react'

export function useCooldown(seconds: number) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) setEndsAt(null)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt])

  const start = useCallback(
    () => setEndsAt(Date.now() + seconds * 1000),
    [seconds],
  )
  return { remaining, start }
}
