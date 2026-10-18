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
 * `ConvexAuthRecovery` calls it: when Clerk is signed in, our token fetch came
 * back empty for that session, Convex has given up, and the socket is up — on the reconnect, on returning to the foreground, and
 * then with backoff while the token still cannot be had.
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
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import { needsReauthentication, reauthDelay } from './reauthentication'

interface Reauth {
  attempt: number
  reauthenticate: () => void
  /** The Clerk session whose last token fetch came back empty, if any. */
  failedSession: string | null
  recordTokenFetch: (sessionId: string | null, ok: boolean) => void
}

const ReauthContext = createContext<Reauth>({
  attempt: 0,
  reauthenticate: () => {},
  failedSession: null,
  recordTokenFetch: () => {},
})

/** Convex's own Clerk adapter, plus `attempt` in the token fetcher's identity. */
function useAuthFromClerk() {
  const {
    isLoaded,
    isSignedIn,
    getToken,
    orgId,
    orgRole,
    sessionId,
    sessionClaims,
  } = useAuth()
  const { attempt, recordTokenFetch } = use(ReauthContext)
  // Read through a ref, as Convex's adapter effectively does by leaving them
  // out of its deps: a new `getToken` must not mean a new authentication.
  const latest = useRef({ getToken, sessionClaims })
  useEffect(() => {
    latest.current = { getToken, sessionClaims }
  }, [getToken, sessionClaims])

  // Keyed like Convex's adapter (the session), plus the re-auth attempt. A new
  // identity is the whole signal: it makes the provider call `setAuth` again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is the signal
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
      recordTokenFetch(sessionId ?? null, token !== null)
      return token
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, orgRole, sessionId, attempt],
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
  const { isSignedIn, sessionId } = useAuth()
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { isWebSocketConnected } = useConvexConnectionState()
  const { reauthenticate, failedSession } = use(ReauthContext)
  const failures = useRef(0)
  const [foregrounded, setForegrounded] = useState(0)

  const needed = needsReauthentication({
    signedIn: isSignedIn === true,
    tokenFetchFailed: failedSession !== null && failedSession === sessionId,
    convexLoading: isLoading,
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
  const [attempt, setAttempt] = useState(0)
  const [failedSession, setFailedSession] = useState<string | null>(null)
  const reauthenticate = useCallback(() => setAttempt((n) => n + 1), [])
  const recordTokenFetch = useCallback(
    (sessionId: string | null, ok: boolean) =>
      setFailedSession(ok ? null : sessionId),
    [],
  )
  const value = useMemo(
    () => ({ attempt, reauthenticate, failedSession, recordTokenFetch }),
    [attempt, reauthenticate, failedSession, recordTokenFetch],
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
