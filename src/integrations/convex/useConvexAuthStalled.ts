import { useAuth } from '@clerk/clerk-react'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'

/** How long Convex may stay unauthenticated for a signed-in user before we
 * treat the handshake as broken rather than slow. */
export const AUTH_STALLED_AFTER_MS = 10_000

/**
 * True when Clerk reports a signed-in user but Convex has not authenticated
 * that session within `stalledAfterMs`.
 *
 * Convex reports a handshake it has abandoned as `{isLoading: false,
 * isAuthenticated: false}` - the same shape as a signed-out visitor - and never
 * retries it, so a caller that waits on `isAuthenticated` alone waits forever.
 * The timer also covers a token fetch that simply never settles, which Convex
 * reports as a permanent `{isLoading: true}`.
 */
export function useConvexAuthStalled(stalledAfterMs = AUTH_STALLED_AFTER_MS) {
  const { isLoaded, isSignedIn } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isAuthenticated) {
      setStalled(false)
      return
    }
    const timeoutId = setTimeout(() => setStalled(true), stalledAfterMs)
    return () => clearTimeout(timeoutId)
  }, [isLoaded, isSignedIn, isAuthenticated, stalledAfterMs])

  return stalled
}
