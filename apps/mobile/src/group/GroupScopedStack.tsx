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
import { useEffect } from 'react'

import { LIVE_MODULES_ONLY } from '../modules/buildModules'
import { isRouteShown } from '../modules/moduleVisibility'
import { TabSafeArea } from '../shell/TabSafeArea'
import { GroupScoped } from './GroupProvider'

export function GroupScopedStack() {
  return (
    <TabSafeArea>
      <Stack
        screenLayout={({ children, route, navigation }) =>
          isRouteShown(route.name, LIVE_MODULES_ONLY) ? (
            <GroupScoped>{children}</GroupScoped>
          ) : (
            <LeaveHiddenModule navigation={navigation} />
          )
        }
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

interface StackNavigation {
  getState(): { index: number } | undefined
  goBack(): void
  replace(name: string): void
}

/**
 * A link, a stored recent or an old Home pin that opens a Module this build
 * hides (`modules/moduleVisibility.ts`, App Review 2.1(a)) draws nothing and
 * leaves: back to the screen beneath it, or to this tab's root when it was
 * opened alone. Never a `Redirect` to another tab, which would leave this
 * screen in its stack and bounce every return to the tab back out again.
 */
function LeaveHiddenModule({ navigation }: { navigation: StackNavigation }) {
  useEffect(() => {
    if ((navigation.getState()?.index ?? 0) > 0) navigation.goBack()
    else navigation.replace('index')
  }, [navigation])
  return null
}
