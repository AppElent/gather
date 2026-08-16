/**
 * Completes an addressed Group-link handoff inside the authenticated shell.
 *
 * It is deliberately a route only while the handoff runs. After validating the
 * link against the live membership answer, it replaces itself with a tabbed
 * destination; the Group then lives solely in `GroupProvider` (ADR-0015).
 */

import { router } from 'expo-router'
import { useEffect, useMemo } from 'react'

import { useGroup } from '../../src/group/GroupProvider'
import { nativeDestinationForGroupLink } from '../../src/shell/groupLink'
import {
  clearPendingGroupLink,
  pendingGroupLink,
} from '../../src/shell/pendingGroupLink'

export default function GroupLinkHandoff() {
  const link = pendingGroupLink()
  const { group, groups, setGroup } = useGroup()
  const destination = useMemo(
    () => (link ? nativeDestinationForGroupLink(link.segments) : null),
    [link],
  )

  useEffect(() => {
    // Do both checks before changing context. Invalid and unsupported links
    // resolve to Home in the Group the Member was already in.
    if (
      !link ||
      !destination ||
      !groups.some((candidate) => candidate.slug === link.groupSlug)
    ) {
      clearPendingGroupLink()
      router.replace('/home')
      return
    }

    // `setGroup` is stateful. Wait for the provider to publish the new ambient
    // Group before mounting the destination, so no destination ever renders
    // under the old Group for one frame.
    if (group.slug !== link.groupSlug) {
      setGroup(link.groupSlug)
      return
    }

    clearPendingGroupLink()
    router.replace(destination)
  }, [destination, group.slug, groups, link, setGroup])

  return null
}
