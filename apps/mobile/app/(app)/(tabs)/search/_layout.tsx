/**
 * Search's Group-keyed stack, the same shape All and Home use.
 *
 * The stack is not decoration: `Stack.SearchBar` on the screen below is the
 * native search bar, and it needs a native header to live in. `TabSafeArea` is
 * the other half — the iOS tab bar's height lands in the *screen's* safe area,
 * where a window-level reading cannot see it.
 */
import { Stack } from 'expo-router'

import { useGroup } from '../../../../src/group/GroupProvider'
import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function SearchStackLayout() {
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
