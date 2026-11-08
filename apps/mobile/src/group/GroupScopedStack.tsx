/**
 * The stack every Group-scoped tab draws: Home, All and Search, the tabs in
 * `GROUP_SCOPED_TABS` beside it in `groupUnwind.ts`. A tab that uses this
 * belongs in that list, and one in the list uses this.
 *
 * A Group switch resets it to a fresh root through navigation state
 * (`groupUnwind.ts`), never by remounting it: re-keying a native stack inside
 * a tab crashes Android (#235). Its screens draw through `GroupScoped`, so
 * none of them renders in the new Group before that reset has landed.
 *
 * `TabSafeArea` puts the iOS tab bar's height in the *screen's* safe area,
 * where a window-level reading cannot see it.
 */
import { Stack } from 'expo-router'

import { TabSafeArea } from '../shell/TabSafeArea'
import { GroupScoped } from './GroupProvider'

export function GroupScopedStack() {
  return (
    <TabSafeArea>
      <Stack
        screenLayout={({ children }) => <GroupScoped>{children}</GroupScoped>}
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
