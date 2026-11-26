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
 * which the backend rejects rather than re-provisioning (ADR-0032). It is
 * reported as `deleted`, not `failed`: retrying cannot help, and the gate says
 * so on a phone other than the one that asked for the deletion (APP-939). The
 * phone that asked never sees it, because once the purge starts
 * `AccountDeleteProvider` unmounts the gate and with it this hook.
 * Anything else is reported as `failed`, because an account with no `users` row
 * is held behind `ConvexSessionGate` until it has one — swallowing it would
 * leave the person on a loading screen forever. `retry` runs it again.
 */

import { useUser } from '@clerk/expo'
import { clerkUserName } from '@gather/core/member-names'
import { ACCOUNT_DELETED, refusalSentence } from '@gather/core/refusals'
import { useConvexAuth, useMutation } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'

import { api } from './api'

export interface Provisioning {
  /** The last attempt was refused for a reason other than a deletion. */
  failed: boolean
  /** The last attempt was refused because the account is being deleted. */
  deleted: boolean
  retry: () => void
}

function isAccountDeletedError(error: unknown): boolean {
  return refusalSentence(error) === ACCOUNT_DELETED
}

export function useEnsureUser(): Provisioning {
  const { isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  // The Convex token carries no name claims, so the name comes from Clerk
  // here (APP-676); without it every Member was saved as "Member".
  const { user } = useUser()
  const name = clerkUserName(user)
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry signal
  useEffect(() => {
    if (!isAuthenticated) return
    // A new attempt (another account, a retry) starts with no refusal.
    setFailed(false)
    setDeleted(false)
    let current = true
    ensureUser({ name })
      .then(() => {
        if (current) setFailed(false)
      })
      .catch((error: unknown) => {
        if (!current) return
        if (isAccountDeletedError(error)) setDeleted(true)
        else setFailed(true)
      })
    return () => {
      current = false
    }
  }, [isAuthenticated, ensureUser, attempt, name])

  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((count) => count + 1)
  }, [])

  return { failed, deleted, retry }
}
