/**
 * Convex authenticated by Clerk, with a way back in after a failed refresh.
 *
 * This is `ConvexProviderWithClerk` with one difference. Convex's adapter
 * memoises `fetchAccessToken` on the Clerk session alone, so the provider only
 * calls `client.setAuth` when the session changes — and after one failed token
 * fetch the client never asks for a token again (`reauthentication.ts`). Here
 * `fetchAccessToken` also changes when `reauthenticate()` is called, which is
 * the supported way to make `ConvexProviderWithAuth` run `setAuth` once more.
 *
 * Each fetcher belongs to a **generation** — one Clerk session and one attempt
 * — and a failure is recorded against the generation whose fetch failed, never
 * cleared, only superseded — and only while that generation is the active
 * one. So a late answer from a session or attempt that has since been
 * replaced cannot raise, hide or overwrite the current one's failure; it is
 * the same rule Convex applies to its own stale fetches (config versions).
 * And only an empty *forced* fetch counts: Convex follows an empty cached
 * lookup with a forced one, and only when that is empty too has it given up.
 *
 * `ConvexAuthRecovery` acts on it — on the reconnect, on returning to the
 * foreground, then with backoff. It is best-effort: a token Convex *rejects*
 * is not a fetch failure and is not seen here. `ConvexSessionGate`'s timeout
 * is what guarantees a way out of every case.
 */
import { useAuth } from '@clerk/expo'
import {
  ConvexProviderWithAuth,
  type ConvexReactClient,
  useConvexAuth,
  useConvexConnectionState,
} from 'convex/react'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import { needsReauthentication, reauthDelay } from './reauthentication'

/** One Clerk session and one re-auth attempt; compared by identity. */
type Generation = object

interface Reauth {
  generation: Generation
  reauthenticate: () => void
  /** Whether Convex has given up on this generation. */
  failed: boolean
  markFailed: (generation: Generation) => void
}

const ReauthContext = createContext<Reauth>({
  generation: {},
  reauthenticate: () => {},
  failed: false,
  markFailed: () => {},
})

/** Convex's own Clerk adapter, with the generation as the token fetcher's
 * identity. */
function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const { generation, markFailed } = use(ReauthContext)
  // Read through a ref, as Convex's adapter effectively does by leaving them
  // out of its deps: a new `getToken` must not mean a new authentication.
  const latest = useRef({ getToken, sessionClaims })
  useEffect(() => {
    latest.current = { getToken, sessionClaims }
  }, [getToken, sessionClaims])

  // A new generation is a new identity, which is the whole signal: it makes the
  // provider call `setAuth` again.
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const { getToken, sessionClaims } = latest.current
      let token: string | null = null
      try {
        // A session token already minted for Convex needs no template.
        token =
          sessionClaims?.aud === 'convex'
            ? await getToken({ skipCache: forceRefreshToken })
            : await getToken({
                template: 'convex',
                skipCache: forceRefreshToken,
              })
      } catch {
        token = null
      }
      // Empty after a cached lookup is not given up: Convex asks again, forced.
      if (token === null && forceRefreshToken) markFailed(generation)
      return token
    },
    [generation, markFailed],
  )

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  )
}

/** Asks for authentication again while Convex has given up on a session Clerk
 * still holds. Renders nothing. */
export function ConvexAuthRecovery() {
  const { isSignedIn } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  const { isWebSocketConnected } = useConvexConnectionState()
  const { reauthenticate, failed } = use(ReauthContext)
  const failures = useRef(0)
  const [foregrounded, setForegrounded] = useState(0)

  const needed = needsReauthentication({
    signedIn: isSignedIn === true,
    tokenFetchFailed: failed,
    convexAuthenticated: isAuthenticated,
    socketConnected: isWebSocketConnected,
  })

  useEffect(() => {
    if (isAuthenticated) failures.current = 0
  }, [isAuthenticated])

  // Coming back to the app is a fresh start: no backoff left over from the
  // last time it was open.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      failures.current = 0
      setForegrounded((count) => count + 1)
    })
    return () => listener.remove()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a foreground restarts the wait
  useEffect(() => {
    if (!needed) return
    const timeout = setTimeout(() => {
      failures.current += 1
      reauthenticate()
    }, reauthDelay(failures.current))
    return () => clearTimeout(timeout)
  }, [needed, foregrounded, reauthenticate])

  return null
}

export function ClerkConvexAuth({
  client,
  children,
}: {
  client: ConvexReactClient
  children: ReactNode
}) {
  const { sessionId, orgId, orgRole } = useAuth()
  const [attempt, setAttempt] = useState(0)
  // A new object whenever the session, its organisation or the attempt
  // changes — the same things Convex's adapter keys on, plus the attempt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the deps are what make a generation
  const generation = useMemo<Generation>(
    () => ({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, orgId, orgRole, attempt],
  )
  const [failedGeneration, setFailedGeneration] = useState<Generation | null>(
    null,
  )
  // Only the active generation may record a failure. A replaced one's fetch
  // can still finish empty after the active one has failed, and writing it
  // down would make `failed` false and stop recovery. A layout effect, so the
  // ref has moved on before any fetch started by the new generation returns.
  const active = useRef(generation)
  useLayoutEffect(() => {
    active.current = generation
  }, [generation])
  const markFailed = useCallback((failing: Generation) => {
    if (failing === active.current) setFailedGeneration(failing)
  }, [])
  const reauthenticate = useCallback(() => setAttempt((n) => n + 1), [])
  const value = useMemo(
    () => ({
      generation,
      reauthenticate,
      failed: failedGeneration === generation,
      markFailed,
    }),
    [generation, reauthenticate, failedGeneration, markFailed],
  )

  return (
    <ReauthContext value={value}>
      <ConvexProviderWithAuth client={client} useAuth={useAuthFromClerk}>
        <ConvexAuthRecovery />
        {children}
      </ConvexProviderWithAuth>
    </ReauthContext>
  )
}

/** For a manual retry (the session error screen): try `setAuth` again now. */
export function useReauthenticate(): () => void {
  return use(ReauthContext).reauthenticate
}
