/**
 * All's own stack, for Home's reason: this is the other tab a Module opens
 * inside (#163), so it is the other one that can be left sitting on the
 * previous Group's content when the Group changes. Its Group-keyed stack
 * resets it to the root without touching the fixed tab navigator.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'

export default function AllStackLayout() {
  const { group } = useGroup()

  return <Stack key={group.slug} screenOptions={{ headerShown: false }} />
}
