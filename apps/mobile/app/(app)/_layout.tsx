/**
 * Behind the door.
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
 */
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/expo'

import { useSignOut } from '../../src/auth/useSignOut'
import { GroupPending } from '../../src/components/GroupPending'
import { NoGroup } from '../../src/components/NoGroup'
import { useEnsureUser } from '../../src/convex/useEnsureUser'
import { GroupProvider } from '../../src/group/GroupProvider'
import { useTokens } from '../../src/theme/tokens'

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
      />
    </GroupProvider>
  )
}
