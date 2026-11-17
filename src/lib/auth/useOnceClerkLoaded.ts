import { useAuth } from '@clerk/react'
import { useEffect, useRef } from 'react'

/**
 * Runs `effect` once, as soon as Clerk has loaded.
 *
 * Before load, `@clerk/react` hands out placeholder resources (a sign-in at
 * `needs_identifier`, a sign-up at `missing_requirements`), so anything that
 * reads an attempt's state on arrival must wait for the real one. After a
 * social redirect the page is a full load, so that wait is the normal case.
 */
export function useOnceClerkLoaded(effect: () => void) {
  const { isLoaded } = useAuth()
  const done = useRef(false)
  const latest = useRef(effect)
  latest.current = effect

  useEffect(() => {
    if (!isLoaded || done.current) return
    done.current = true
    latest.current()
  }, [isLoaded])
}
