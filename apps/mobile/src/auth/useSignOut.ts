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
 */
import { useAuth } from '@clerk/expo'
import { useMutation } from 'convex/react'
import { useCallback } from 'react'

import { api } from '../convex/api'
import { clearLastKnown } from '../convex/lastKnown'
import {
  confirmPushRelease,
  moveRegistrationToRelease,
} from '../features/notifications/push/push-device'
import { clearRetainedGroup } from '../group/retainedGroup'

export function useSignOut(): () => void {
  const { signOut } = useAuth()
  const release = useMutation(api.notifications.releaseDevice)

  return useCallback(() => {
    clearRetainedGroup()
    // The saved query copy and the confirmed-account marker (APP-143), before
    // the session ends, so a relaunch offline shows nothing of this account.
    clearLastKnown()
    const registration = moveRegistrationToRelease()
    if (registration)
      release(registration)
        .then(() => confirmPushRelease(registration))
        .catch(() => {})
    void signOut()
  }, [signOut, release])
}
