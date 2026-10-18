/**
 * Home's own stack. A Group switch resets it to a fresh root through
 * navigation state (`src/group/groupUnwind.ts`), never by remounting it:
 * re-keying a native stack inside a tab crashes Android (#235). Its screens
 * draw through `GroupScoped`, so none of them renders in the new Group before
 * that reset has landed.
 */
import { Stack } from 'expo-router'

import { GroupScoped } from '../../../../src/group/GroupProvider'
import { TabSafeArea } from '../../../../src/shell/TabSafeArea'

export default function HomeStackLayout() {
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
