/**
 * Leaving, which is one more thing than ending the session.
 *
 * The retained Group (ADR-0015) is this phone's memory of where *this account*
 * was. The next person to sign in on the same phone must land in their own
 * landing Group, not on a slug the backend would refuse every query for, and
 * must not find this account's saved Loyalty cards offline — so
 * every way out of the app goes through here, rather than each one remembering
 * to forget.
 */
import { useAuth } from '@clerk/expo'
import { useCallback } from 'react'

import { clearLastKnown } from '../convex/lastKnown'
import { clearRetainedGroup } from '../group/retainedGroup'

export function useSignOut(): () => void {
  const { signOut } = useAuth()

  return useCallback(() => {
    clearRetainedGroup()
    // The saved query copy and the confirmed-account marker (APP-143), before
    // the session ends, so a relaunch offline shows nothing of this account.
    clearLastKnown()
    void signOut()
  }, [signOut])
}
