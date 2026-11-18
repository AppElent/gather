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
 * The phone's push token goes first (APP-298), while there is still a session
 * to unregister it with, so this account's notifications stop reaching a phone
 * it has left. It is given a moment and no more: sign-out never waits on the
 * network, and a token left behind moves to whoever registers it next.
 */
import { useAuth } from '@clerk/expo'
import { useMutation } from 'convex/react'
import { useCallback } from 'react'

import { api } from '../convex/api'
import { clearLastKnown } from '../convex/lastKnown'
import {
  registeredPushToken,
  rememberRegisteredPushToken,
} from '../features/notifications/push/push-device'
import { clearRetainedGroup } from '../group/retainedGroup'

/** How long sign-out waits for the push token to be unregistered. */
const UNREGISTER_WAIT_MS = 3_000

export function useSignOut(): () => void {
  const { signOut } = useAuth()
  const unregister = useMutation(api.notifications.unregisterDevice)

  return useCallback(() => {
    clearRetainedGroup()
    // The saved query copy and the confirmed-account marker (APP-143), before
    // the session ends, so a relaunch offline shows nothing of this account.
    clearLastKnown()
    const token = registeredPushToken()
    rememberRegisteredPushToken(null)
    if (!token) {
      void signOut()
      return
    }
    void Promise.race([
      unregister({ token }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_WAIT_MS)),
    ]).finally(() => signOut())
  }, [signOut, unregister])
}
