/**
 * All's Group-keyed stack. Keying the stack resets pushed module screens when
 * the Group changes while leaving the native tab navigator mounted.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'
import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function AllStackLayout() {
  const { group } = useGroup()

  return (
    <TabSafeArea>
      <Stack
        key={group.slug}
        screenOptions={{
          headerShown: false,
          headerBackButtonDisplayMode: 'minimal',
          headerLargeTitle: true,
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </TabSafeArea>
  )
}
