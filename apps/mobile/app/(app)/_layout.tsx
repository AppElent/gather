/**
 * Behind the door, and the root of the signed-in shell.
 *
 * The guard is Clerk's `isSignedIn`, not Convex's `isAuthenticated`, and that is
 * not interchangeable: the two disagree for the length of the JWT handshake
 * after a sign-in, and guarding on the Convex side produces an infinite bounce
 * between the two halves of the app. The web learned this the hard way; the
 * phone starts on the right side of it.
 *
 * Inside the guard sits the second one, a layer below: `GroupProvider` waits for
 * a *settled Convex answer* about which Groups are the Member's, and nothing
 * Group-scoped renders until there is one. That is deliberately not the same
 * check — it reads data, not identity — and it is why the trap above does not
 * apply to it.
 *
 * ## Why this is a Stack with the tabs inside it
 *
 * The tab bar is fixed and stable across Groups (ADR-0015), so anything that is
 * *not* one of the five destinations has to sit somewhere else — and the native
 * answer is above them, in this stack. The Group switcher was the first such
 * surface; Settings, Account and Groups joined it in #164. They get native push
 * and back behaviour and never compete with the bar.
 *
 * The three pushed screens are the only ones in the app with a native header,
 * and they are declared here rather than in each screen so that the titles read
 * as one list. They are `headerShown` because a pushed screen needs the
 * platform's back affordance; the tabs are not, because each of those draws its
 * own heading and a native header above it would title the same thing twice.
 * Their colours come from `NativeChrome`'s navigation theme, not from here.
 *
 * `anchor` is the part that is not obvious. A `Stack` takes its initial route
 * from the first screen it is *told* about, so without this the app opens on
 * the switcher sheet. Found on the emulator, not by reading.
 */
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/expo'
import { View } from 'react-native'

import { useSignOut } from '../../src/auth/useSignOut'
// PROTOTYPE — throwaway. See `src/prototype/tabLayout/README.md`.
import { PrototypeSwitcher } from '../../src/prototype/tabLayout/PrototypeSwitcher'
import { GroupPending } from '../../src/components/GroupPending'
import { NoGroup } from '../../src/components/NoGroup'
import { useEnsureUser } from '../../src/convex/useEnsureUser'
import { GroupProvider } from '../../src/group/GroupProvider'
import { useI18n } from '../../src/i18n'
import { useTokens } from '../../src/theme/tokens'

export const unstable_settings = { anchor: '(tabs)' }

export default function AppLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()
  const { t } = useI18n()
  const signOut = useSignOut()

  // Before any of the below can find a Group, there has to be a Member to have
  // one. Same call the web's `_app.tsx` makes, for the same reason.
  useEnsureUser()

  if (!isSignedIn) return <Redirect href="/" />

  return (
    <GroupProvider
      pending={<GroupPending />}
      none={<NoGroup onSignOut={signOut} />}
    >
      {/* PROTOTYPE — the wrapper exists only so the switcher can float over
          the whole signed-in shell. Both go with the prototype. */}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.bg },
          }}
        >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="deep-link" />
        {/* A sheet with an address, so the back gesture and the swipe down
            dismiss it for free and neither has to be re-implemented as state
            (ADR-0015). */}
        <Stack.Screen
          name="switch-group"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.55, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: true, title: t.settings.title }}
        />
        <Stack.Screen
          name="account"
          options={{ headerShown: true, title: t.account.title }}
        />
        <Stack.Screen
          name="groups"
          options={{ headerShown: true, title: t.shell.groups.title }}
        />
        </Stack>
        {/* After the Stack so it paints over it on every platform. */}
        <PrototypeSwitcher />
      </View>
    </GroupProvider>
  )
}
