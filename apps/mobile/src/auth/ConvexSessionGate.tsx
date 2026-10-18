/**
 * Holds the signed-in tree until Convex has authenticated *this* Clerk session.
 *
 * `(app)/_layout` guards navigation on Clerk's `isSignedIn` — guarding the
 * redirect on Convex bounces forever between `(app)` and `(auth)` — and this
 * gate is the other half of that split: navigation follows Clerk, data follows
 * Convex. It sits below the redirect so the two never fight. What "Convex has
 * authenticated this session" means, and why the backend has to be asked, is
 * `sessionGate.ts`.
 *
 * It is also the prerequisite the Convex query caching standard sets before
 * any subscription retention may be added: a cache below this gate cannot show
 * one account's results to another.
 *
 * While closed it draws a bare surface, and only after `PENDING_REVEAL_MS` the
 * `pending` screen. On a cold start the handshake has usually finished behind
 * the held splash (which the bare surface does not hide), and straight after
 * signing in it takes a round trip; a loading screen that flashes for a frame
 * in either case reads as a glitch. The delay is the escape hatch for when it
 * does not: `pending` hides the splash and says something is happening.
 *
 * The children are keyed by the account, so nothing a previous account's
 * screens held in state can survive into the next one's.
 *
 * ## Losing Convex auth without changing account
 *
 * The gate also closes, and the tree unmounts, when Convex loses the session
 * of the account still signed in to Clerk — a token refresh that failed
 * offline. The caching standard would allow keeping that tree: its gate exists
 * so no account sees another's data or sees data before authenticating, and
 * neither is at stake here. The Convex client is what rules it out. Losing auth
 * sends `Authenticate` with no token, and the server then re-runs every mounted
 * subscription anonymously: some throw `Unauthenticated` out of render, others
 * answer as if for nobody (`groups.myGroups` is `[]`, so `GroupProvider` would
 * announce that the Member has no Group). Staying mounted would not keep what
 * was on screen; it would swap it for those answers. So the tree goes, and
 * `ConvexAuthRecovery` brings the session back without anybody tapping
 * anything once the connection returns. A plain socket disconnect is not this
 * case: it leaves `isAuthenticated` true, and the tree stays.
 *
 * Revisit with the app-owned query module: it is the one place that could hold
 * same-account results through an auth loss, because it sits in front of every
 * subscription.
 *
 * If `users.me` itself fails, `SessionIdentityBoundary` catches it and draws
 * `SessionError` — try again or sign out — rather than letting the throw reach
 * Expo Router's root error screen.
 *
 * The gate also owns provisioning (`useEnsureUser`), because a signed-in
 * account with no `users` row is held here until it has one. When that write
 * is refused, or has not landed within `PROVISION_WAIT_MS`, the same
 * `SessionError` offers to run it again or to sign out (`closedGateView`).
 */
import { useAuth } from '@clerk/expo'
import { type RequestForQueries, useConvexAuth, useQueries } from 'convex/react'
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import { api } from '../../../../convex/_generated/api'
import type { Doc } from '../../../../convex/_generated/dataModel'
import { SessionError } from '../components/SessionError'
import { useReauthenticate } from '../convex/ClerkConvexAuth'
import { type Provisioning, useEnsureUser } from '../convex/useEnsureUser'
import { useTokens } from '../theme/tokens'
import {
  SessionIdentityBoundary,
  SessionIdentityError,
} from './SessionIdentityBoundary'
import {
  closedGateView,
  confirmSession,
  isSessionOpen,
  UNCONFIRMED,
} from './sessionGate'

/** How long the gate stays a bare surface before admitting it is waiting. */
export const PENDING_REVEAL_MS = 600

/** How long an account with no `users` row waits for `ensureUser` before the
 * gate offers to retry it. One round trip on a healthy connection; this is
 * several. */
export const PROVISION_WAIT_MS = 10_000

export interface ConvexSessionGateProps {
  children: ReactNode
  /** Drawn once the wait has outlasted `PENDING_REVEAL_MS`. */
  pending: ReactNode
  /** The way out offered when the identity query fails. */
  onSignOut: () => void
}

export function ConvexSessionGate({
  onSignOut,
  ...props
}: ConvexSessionGateProps) {
  const reauthenticate = useReauthenticate()
  // Outside the boundary, so a retry there does not restart provisioning.
  const provisioning = useEnsureUser()
  return (
    <SessionIdentityBoundary
      onRetry={reauthenticate}
      fallback={(retry) => (
        <SessionError onRetry={retry} onSignOut={onSignOut} />
      )}
    >
      <Gate {...props} provisioning={provisioning} onSignOut={onSignOut} />
    </SessionIdentityBoundary>
  )
}

/** `users.me`, with a failure thrown as the error the boundary recovers from
 * rather than as whatever Convex threw. */
function useViewer(enabled: boolean): Doc<'users'> | null | undefined {
  // Memoised: `useQueries` keys its subscription on this object's identity,
  // and a fresh one every render re-subscribes in a render loop.
  const queries = useMemo((): RequestForQueries => {
    if (!enabled) return {}
    return { me: { query: api.users.me, args: {} } }
  }, [enabled])
  const { me } = useQueries(queries)
  if (me instanceof Error) throw new SessionIdentityError(me)
  return me as Doc<'users'> | null | undefined
}

function Gate({
  children,
  pending,
  provisioning,
  onSignOut,
}: ConvexSessionGateProps & { provisioning: Provisioning }) {
  const { userId } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  const tokens = useTokens()
  const viewer = useViewer(isAuthenticated)

  const input = { account: userId, isAuthenticated, viewer }
  const [confirmation, setConfirmation] = useState(UNCONFIRMED)
  // Adjusted during render, React's pattern for state derived from a changing
  // input; `confirmSession` returns the same object once it has converged.
  const next = confirmSession(confirmation, input)
  if (next !== confirmation) setConfirmation(next)

  const open = isSessionOpen(input, next)

  // Re-armed every time the gate closes, so a later wait starts quiet again.
  const [revealed, setRevealed] = useState(false)
  if (open && revealed) setRevealed(false)
  useEffect(() => {
    if (open) return
    const timeout = setTimeout(() => setRevealed(true), PENDING_REVEAL_MS)
    return () => clearTimeout(timeout)
  }, [open])

  // Restarted by every provisioning attempt, including a retry.
  const unprovisioned = isAuthenticated && viewer === null
  const [expiredAttempt, setExpiredAttempt] = useState<number | null>(null)
  useEffect(() => {
    if (!unprovisioned) return
    const attempt = provisioning.attempt
    const timeout = setTimeout(
      () => setExpiredAttempt(attempt),
      PROVISION_WAIT_MS,
    )
    return () => clearTimeout(timeout)
  }, [unprovisioned, provisioning.attempt])

  if (!open) {
    const view = closedGateView({
      unprovisioned,
      provisioningFailed: provisioning.failed,
      provisionWaitExpired: expiredAttempt === provisioning.attempt,
      revealed,
    })
    if (view === 'recover') {
      return <SessionError onRetry={provisioning.retry} onSignOut={onSignOut} />
    }
    return view === 'pending' ? (
      pending
    ) : (
      <View style={{ flex: 1, backgroundColor: tokens.bg }} />
    )
  }

  return <Fragment key={userId}>{children}</Fragment>
}
