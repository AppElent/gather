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
 */
import { useAuth } from '@clerk/expo'
import { useConvexAuth, useQuery } from 'convex/react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { View } from 'react-native'

import { api } from '../../../../convex/_generated/api'
import { useTokens } from '../theme/tokens'
import { confirmSession, isSessionOpen, UNCONFIRMED } from './sessionGate'

/** How long the gate stays a bare surface before admitting it is waiting. */
export const PENDING_REVEAL_MS = 600

export interface ConvexSessionGateProps {
  children: ReactNode
  /** Drawn once the wait has outlasted `PENDING_REVEAL_MS`. */
  pending: ReactNode
}

export function ConvexSessionGate({
  children,
  pending,
}: ConvexSessionGateProps) {
  const { userId } = useAuth()
  const { isAuthenticated } = useConvexAuth()
  const tokens = useTokens()
  const viewer = useQuery(api.users.me, isAuthenticated ? {} : 'skip')

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

  if (!open) {
    return revealed ? (
      pending
    ) : (
      <View style={{ flex: 1, backgroundColor: tokens.bg }} />
    )
  }

  return <Fragment key={userId}>{children}</Fragment>
}
