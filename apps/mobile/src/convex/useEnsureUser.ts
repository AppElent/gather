/**
 * The one write the phone makes just by arriving.
 *
 * A Clerk identity is not yet a Gather Member: the `users` row and everybody's
 * Personal group are created by `users.ensureUser`, which the web calls from
 * `src/routes/_app.tsx` on every authenticated mount. Without the same call
 * here, somebody who signs up on the phone has an account, no `users` row, and
 * therefore an empty `myGroups` forever — the "no Group at all" screen, for an
 * account that should have had a Personal group the moment it signed in.
 *
 * It is deliberately keyed on **Convex's** `isAuthenticated` rather than Clerk's
 * `isSignedIn`. The two disagree for the length of the JWT handshake, and this
 * is a call the backend would refuse during it. That is not the redirect trap
 * `clerk-convex-dual-auth-redirect-loop` warns about — nothing here navigates —
 * it is the same distinction read from the other side: guards follow the
 * session, writes follow the token.
 *
 * The mutation is idempotent, so a re-run after a reconnect costs a round trip
 * and nothing else.
 *
 * It has one refusal that is not a failure: an account that is mid-deletion,
 * which the backend rejects rather than re-provisioning (ADR-0032). The screen
 * that asked for the deletion is already signing out, so that one is swallowed.
 * Anything else is reported as `failed`, because an account with no `users` row
 * is held behind `ConvexSessionGate` until it has one — swallowing it would
 * leave the person on a loading screen forever. `retry` runs it again.
 */

import { useConvexAuth, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { ACCOUNT_DELETED } from '../../../../convex/lib/sharing'

export interface Provisioning {
  /** The last attempt was refused for a reason other than a deletion. */
  failed: boolean
  /** Counts attempts, so a caller can restart a wait when one begins. */
  attempt: number
  retry: () => void
}

export function isAccountDeletedError(error: unknown): boolean {
  return error instanceof ConvexError && error.data === ACCOUNT_DELETED
}

export function useEnsureUser(): Provisioning {
  const { isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry signal
  useEffect(() => {
    if (!isAuthenticated) return
    let current = true
    ensureUser({})
      .then(() => {
        if (current) setFailed(false)
      })
      .catch((error: unknown) => {
        if (current && !isAccountDeletedError(error)) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [isAuthenticated, ensureUser, attempt])

  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((count) => count + 1)
  }, [])

  return { failed, attempt, retry }
}
