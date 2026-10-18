/**
 * When to ask Convex to authenticate again, kept free of React so the Node
 * suite can check it.
 *
 * The installed client (convex 1.42) gives up on authentication for good after
 * one failed token fetch: `AuthenticationManager.refetchToken` clears the auth,
 * reports `isAuthenticated: false`, and parks in `noAuth`, where nothing ever
 * fetches a token again. A websocket reconnect does not retry it either — the
 * socket comes back anonymous. The scheduled refresh fails exactly that way
 * when Clerk cannot be reached, so a phone that was offline past its token's
 * lifetime would come back online and stay signed out of Convex until the app
 * was killed.
 *
 * The only way back in is `client.setAuth` again, which `ConvexProviderWithAuth`
 * calls whenever the identity of `fetchAccessToken` changes. `ClerkConvexAuth`
 * changes it on demand; this file decides when to ask. It is best-effort: the
 * guarantee of a way out is `ConvexSessionGate`'s timeout.
 */

/** Waits before each successive attempt; the last one repeats. The first is
 * immediate, because the usual trigger is the connection coming back. */
export const REAUTH_BACKOFF_MS = [0, 2_000, 5_000, 15_000, 30_000] as const

export function reauthDelay(attempt: number): number {
  return REAUTH_BACKOFF_MS[Math.min(attempt, REAUTH_BACKOFF_MS.length - 1)]
}

export interface ReauthInput {
  /** Clerk still holds a session. */
  signedIn: boolean
  /**
   * A forced token fetch of the current generation came back empty — what
   * sends the client to `noAuth`. Convex's own flags cannot say it: straight
   * after signing in it also reports "not authenticated" while the handshake
   * is still running, and retrying then would only race it.
   */
  tokenFetchFailed: boolean
  convexAuthenticated: boolean
  /** The socket is up, so a token fetch has a chance and a retry is not a
   * guaranteed failure. */
  socketConnected: boolean
}

/**
 * Clerk says signed in, our token fetch failed, and Convex has settled on "not
 * authenticated": the client has given up and will not try again by itself.
 * While offline there is no point trying; the reconnect is what makes it worth
 * asking.
 */
export function needsReauthentication({
  signedIn,
  tokenFetchFailed,
  convexAuthenticated,
  socketConnected,
}: ReauthInput): boolean {
  return signedIn && tokenFetchFailed && !convexAuthenticated && socketConnected
}
