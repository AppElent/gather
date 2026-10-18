/**
 * All's stack. A Group switch resets it to a fresh root through navigation
 * state (`src/group/groupUnwind.ts`), never by remounting it: re-keying a
 * native stack inside a tab crashes Android (#235).
 */
import { Stack } from 'expo-router'

import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function AllStackLayout() {
  return (
    <TabSafeArea>
      <Stack
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
