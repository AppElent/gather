/**
 * Leaving, which is one more thing than ending the session.
 *
 * The retained Group (ADR-0015) is this phone's memory of where *this account*
 * was. The next person to sign in on the same phone must land in their own
 * landing Group, not on a slug the backend would refuse every query for — so
 * every way out of the app goes through here, rather than each one remembering
 * to forget.
 */
import { useAuth } from '@clerk/expo'
import { useCallback } from 'react'

import { clearRetainedGroup } from '../group/retainedGroup'

export function useSignOut(): () => void {
  const { signOut } = useAuth()

  return useCallback(() => {
    clearRetainedGroup()
    void signOut()
  }, [signOut])
}
