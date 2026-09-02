/**
 * Home's own stack. Home is keyed by Group so pushed module screens reset on
 * Group changes, while the native tab navigator remains mounted.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'
import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function HomeStackLayout() {
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
