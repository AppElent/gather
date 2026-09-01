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
 * It has exactly one refusal: an account that is mid-deletion, which the
 * backend rejects rather than re-provisioning (ADR-0032). There is nothing to
 * say about it here — the screen that asked for the deletion is already signing
 * out — so it is swallowed rather than surfaced.
 */
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'

import { api } from '../../../../convex/_generated/api'

export function useEnsureUser() {
  const { isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)

  useEffect(() => {
    if (isAuthenticated) void ensureUser({}).catch(() => {})
  }, [isAuthenticated, ensureUser])
}
