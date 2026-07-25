import { useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import { useCallback, useMemo } from 'react'
import {
  ConvexAuthRecoveryProvider,
  ConvexAuthWatchdog,
  useConvexAuthRetryNonce,
} from './authRecovery'
import { fetchClerkConvexToken } from './clerkToken'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  throw new Error('Missing VITE_CONVEX_URL')
}

const convex = new ConvexReactClient(CONVEX_URL)

/**
 * Local copy of convex's own `ConvexProviderWithClerk` bridge, with two changes:
 * token fetches are retried instead of failing the whole handshake on the first
 * hiccup (clerkToken.ts), and `retryNonce` gives the watchdog a way to restart a
 * handshake convex has already abandoned (authRecovery.tsx).
 */
function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionClaims } =
    useAuth()
  const retryNonce = useConvexAuthRetryNonce()
  const sessionTargetsConvex = sessionClaims?.aud === 'convex'

  // A new identity here is what makes convex re-run `client.setAuth(...)`, so
  // the dependency list is deliberate rather than exhaustive: anything from the
  // JWT that should be reactive, plus the recovery nonce. `getToken` is left out
  // because Clerk does not memoize it in every runtime, which would restart the
  // handshake on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is the API
  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      fetchClerkConvexToken(getToken, {
        sessionTargetsConvex,
        forceRefreshToken,
      }),
    [orgId, orgRole, sessionTargetsConvex, retryNonce],
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

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexAuthRecoveryProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
        <ConvexAuthWatchdog />
        {children}
      </ConvexProviderWithAuth>
    </ConvexAuthRecoveryProvider>
  )
}
