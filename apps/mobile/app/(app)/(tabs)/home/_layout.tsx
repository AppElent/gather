/**
 * Home's own stack.
 *
 * A tab is a stack because ADR-0015's reset is about stacks: the hazard it
 * names is a screen *pushed inside a tab* still sitting on the previous Group's
 * id. Home is where a Module opened from a Pin will be pushed (#163), so it is
 * one of the two tabs that can hold such a screen. Keying this stack by the
 * Group slug replaces any pushed content at a Group switch while leaving the
 * fixed native tab navigator mounted.
 *
 * No native header: Home draws its own, because the one thing it has to put
 * there — the Group's name, as the control that changes it — is not a title
 * and has no slot in the native one (#142).
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'

export default function HomeStackLayout() {
  const { group } = useGroup()

  return <Stack key={group.slug} screenOptions={{ headerShown: false }} />
}
