/**
 * Leaving, which is one more thing than ending the session.
 *
 * The retained Group (ADR-0015) is this phone's memory of where *this account*
 * was. The next person to sign in on the same phone must land in their own
 * landing Group, not on a slug the backend would refuse every query for, and
 * must not find this account's saved Loyalty cards offline — so
 * every way out of the app goes through here, rather than each one remembering
 * to forget.
 *
 * The phone's push registration is released too (APP-298), so this account's
 * notifications stop reaching a phone it has left. The release needs no
 * session (`notifications.releaseDevice`), so sign-out does not wait for it:
 * it is kept on the phone until the server confirms it, and
 * `PushReleaseRetry` sends it again on the next launch if it did not land.
 *
 * Only one session ends (APP-824): Clerk's `signOut` without a `sessionId`
 * ends every session on the phone.
 */
import { useClerk } from '@clerk/expo'
import { useMutation } from 'convex/react'
import { useCallback } from 'react'

import { api } from '../convex/api'
import { clearLastKnown } from '../convex/lastKnown'
import { forgetOpenCard } from '../features/loyalty-cards/card/open-card-store'
import {
  confirmPushRelease,
  moveRegistrationToRelease,
} from '../features/notifications/push/push-device'
import { clearRetainedGroup } from '../group/retainedGroup'

/** What this phone keeps of the account, without ending any session: for a
 * session that has already ended by itself (APP-771). */
export function useForgetAccount(): () => void {
  const release = useMutation(api.notifications.releaseDevice)

  return useCallback(() => {
    clearRetainedGroup()
    forgetOpenCard()
    // The saved query copy and the confirmed-account marker (APP-143), before
    // the session ends, so a relaunch offline shows nothing of this account.
    clearLastKnown()
    const registration = moveRegistrationToRelease()
    if (registration)
      release(registration)
        .then(() => confirmPushRelease(registration))
        .catch(() => {})
  }, [release])
}

/** Leaves the account and ends the named session, and no other. */
export function useEndSession(): (sessionId: string) => void {
  const clerk = useClerk()
  const forgetAccount = useForgetAccount()

  return useCallback(
    (sessionId: string) => {
      forgetAccount()
      // A failed request rejects with Clerk still between sessions, which the
      // app shows as loading for good. The person has left either way.
      clerk
        .signOut({ sessionId })
        .catch(() => clerk.setActive({ session: null }))
        .catch(() => {})
    },
    [clerk, forgetAccount],
  )
}

/** Leaves the account and ends the session that is current when it is called. */
export function useSignOut(): () => void {
  const clerk = useClerk()
  const endSession = useEndSession()
  const forgetAccount = useForgetAccount()

  return useCallback(() => {
    // Read live. With no session there is none to end, only the phone to clear.
    if (clerk.session) endSession(clerk.session.id)
    else forgetAccount()
  }, [clerk, endSession, forgetAccount])
}
