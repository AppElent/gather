/**
 * Completes an addressed Group-link handoff inside the authenticated shell.
 *
 * It is a route only while the handoff runs. After validating the link
 * against the live membership answer, it replaces itself with a tabbed
 * destination; the Group then lives solely in `GroupProvider` (ADR-0031).
 */
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'

import { useGroup } from '../group/GroupProvider'
import { groupLinkStep } from './groupLink'
import { clearPendingGroupLink, pendingGroupLink } from './pendingGroupLink'

export function GroupLinkHandoff() {
  const { group, groups, setGroup } = useGroup()
  // Read once: clearing the pending link must not turn this same handoff into
  // a refused one on its way out.
  const [link] = useState(pendingGroupLink)
  const step = useMemo(
    () => groupLinkStep(link, group._id, groups),
    [link, group._id, groups],
  )

  useEffect(() => {
    // `setGroup` is stateful. Wait for the provider to publish the new ambient
    // Group before mounting the destination, so no destination ever renders
    // under the old Group for one frame.
    if (step.kind === 'switch') {
      setGroup(step.groupId)
      return
    }
    // Invalid and unsupported links resolve to Home in the Group the Member
    // was already in.
    clearPendingGroupLink()
    router.replace(step.kind === 'open' ? step.href : '/home')
  }, [step, setGroup])

  return null
}
