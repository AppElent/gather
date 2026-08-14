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
 * answer is above them, in this stack. The Group switcher is the first such
 * surface; Settings, Account and Groups join it here in #164. They get native
 * push and back behaviour and never compete with the bar.
 *
 * `anchor` is the part that is not obvious. A `Stack` takes its initial route
 * from the first screen it is *told* about, so without this the app opens on
 * the switcher sheet. Found on the emulator, not by reading.
 */
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/expo'

import { useSignOut } from '../../src/auth/useSignOut'
import { GroupPending } from '../../src/components/GroupPending'
import { NoGroup } from '../../src/components/NoGroup'
import { useEnsureUser } from '../../src/convex/useEnsureUser'
import { GroupProvider } from '../../src/group/GroupProvider'
import { useTokens } from '../../src/theme/tokens'

export const unstable_settings = { anchor: '(tabs)' }

export default function AppLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
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
      </Stack>
    </GroupProvider>
  )
}
