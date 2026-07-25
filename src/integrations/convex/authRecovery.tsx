import { useAuth } from '@clerk/clerk-react'
import { useConvexAuth } from 'convex/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/**
 * Watches the Clerk -> Convex handshake and restarts it when it dies.
 *
 * Convex gives up on the handshake permanently after a single unusable token
 * (see clerkToken.ts) and exposes no way to ask it to try again: the only lever
 * is the identity of the `fetchAccessToken` callback, which is what re-runs
 * `client.setAuth(...)`. So the bridge in provider.tsx folds `retryNonce` into
 * that callback's dependencies, and bumping the nonce here forces a fresh
 * handshake without reloading the page.
 */

/** Automatic handshake restarts before the UI asks the user to intervene. */
export const MAX_RECOVERY_ATTEMPTS = 3
/** Grace period before each restart, in ms, indexed by attempts already made. */
export const RECOVERY_RETRY_DELAYS_MS = [500, 2000, 4000]
/** Convex cannot report a hung token fetch, so cap how long "loading" may last. */
export const STUCK_LOADING_MS = 12_000

interface ConvexAuthRecoveryContextValue {
  /** Bumped to make convex/react re-run `client.setAuth(...)`. */
  nonce: number
  /** Automatic recovery is spent; the app should surface an error instead. */
  failed: boolean
  attempt: number
  /** User-initiated restart, which also restores the automatic attempt budget. */
  retry: () => void
  retryAutomatically: () => void
  markFailed: () => void
  markRecovered: () => void
}

const ConvexAuthRecoveryContext = createContext<
  ConvexAuthRecoveryContextValue | undefined
>(undefined)

function useRecoveryContext() {
  const context = useContext(ConvexAuthRecoveryContext)
  if (!context) {
    throw new Error('Missing <ConvexAuthRecoveryProvider> ancestor')
  }
  return context
}

/** Public view of the recovery state, for auth-gated UI. */
export function useConvexAuthRecovery() {
  const { failed, retry } = useRecoveryContext()
  return useMemo(() => ({ failed, retry }), [failed, retry])
}

/** Consumed by the Clerk auth bridge to key its `fetchAccessToken` identity. */
export function useConvexAuthRetryNonce() {
  return useRecoveryContext().nonce
}

interface RecoveryState {
  nonce: number
  attempt: number
  failed: boolean
}

export function ConvexAuthRecoveryProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<RecoveryState>({
    nonce: 0,
    attempt: 0,
    failed: false,
  })

  const retry = useCallback(
    () =>
      setState((current) => ({
        nonce: current.nonce + 1,
        attempt: 0,
        failed: false,
      })),
    [],
  )

  const retryAutomatically = useCallback(
    () =>
      setState((current) => ({
        nonce: current.nonce + 1,
        attempt: current.attempt + 1,
        failed: false,
      })),
    [],
  )

  const markFailed = useCallback(
    () =>
      setState((current) =>
        current.failed ? current : { ...current, failed: true },
      ),
    [],
  )

  const markRecovered = useCallback(
    () =>
      setState((current) =>
        current.attempt === 0 && !current.failed
          ? current
          : { ...current, attempt: 0, failed: false },
      ),
    [],
  )

  const value = useMemo(
    () => ({
      ...state,
      retry,
      retryAutomatically,
      markFailed,
      markRecovered,
    }),
    [state, retry, retryAutomatically, markFailed, markRecovered],
  )

  return (
    <ConvexAuthRecoveryContext.Provider value={value}>
      {children}
    </ConvexAuthRecoveryContext.Provider>
  )
}

/**
 * Renders nothing; must live inside `ConvexProviderWithAuth` so it can observe
 * `useConvexAuth()`.
 */
export function ConvexAuthWatchdog() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { attempt, failed, retryAutomatically, markFailed, markRecovered } =
    useRecoveryContext()

  useEffect(() => {
    // Clerk is the source of truth for whether a session should exist at all.
    if (!isLoaded || !isSignedIn) return
    if (isAuthenticated) {
      markRecovered()
      return
    }
    if (failed) return

    // Convex is either mid-handshake or has silently given up - it reports the
    // latter as `{isLoading: false, isAuthenticated: false}`, the same shape as
    // a signed-out visitor, and a hung token fetch as a permanent
    // `{isLoading: true}`. Neither resolves on its own, so time both out.
    const delay = isLoading
      ? STUCK_LOADING_MS
      : RECOVERY_RETRY_DELAYS_MS[
          Math.min(attempt, RECOVERY_RETRY_DELAYS_MS.length - 1)
        ]

    const timeoutId = setTimeout(() => {
      if (attempt >= MAX_RECOVERY_ATTEMPTS) markFailed()
      else retryAutomatically()
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [
    isLoaded,
    isSignedIn,
    isLoading,
    isAuthenticated,
    attempt,
    failed,
    retryAutomatically,
    markFailed,
    markRecovered,
  ])

  return null
}
