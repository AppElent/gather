/**
 * Completes an addressed Group-link handoff inside the authenticated shell.
 *
 * It is a route only while the handoff runs. After validating the link
 * against the live membership answer, it replaces itself with a tabbed
 * destination; the Group then lives solely in `GroupProvider` (ADR-0031).
 */
import { router } from 'expo-router'
import { useEffect, useState } from 'react'

import { useGroup, useOpenInGroup } from '../group/GroupProvider'
import { groupLinkTarget } from './groupLink'
import { clearPendingGroupLink, pendingGroupLink } from './pendingGroupLink'

export function GroupLinkHandoff() {
  const { groups } = useGroup()
  const openInGroup = useOpenInGroup()
  // Read once: clearing the pending link must not turn this same handoff into
  // a refused one on its way out.
  const [target] = useState(() => groupLinkTarget(pendingGroupLink(), groups))

  useEffect(() => {
    // Invalid and unsupported links resolve to Home in the Group the Member
    // was already in.
    if (!target) {
      clearPendingGroupLink()
      router.replace('/home')
      return
    }
    openInGroup(target.groupId, () => {
      clearPendingGroupLink()
      router.replace(target.href)
    })
  }, [target, openInGroup])

  return null
}
