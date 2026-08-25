/**
 * The signed-in root stack.
 *
 * The tab bar stays fixed across Groups (ADR-0015). Full Module create forms
 * live above it, while Profile owns Settings, Account
 * and Groups inside its tab stack (ADR-0018), so a permanent destination keeps
 * the bar available.
 */
import { useAuth } from '@clerk/expo'
import { Redirect, Stack } from 'expo-router'

import { useSignOut } from '../../src/auth/useSignOut'
import { GroupPending } from '../../src/components/GroupPending'
import { NoGroup } from '../../src/components/NoGroup'
import { useEnsureUser } from '../../src/convex/useEnsureUser'
import { DropGate } from '../../src/drop/DropGate'
import { GroupProvider } from '../../src/group/GroupProvider'
import { useTokens } from '../../src/theme/tokens'

export const unstable_settings = { anchor: '(tabs)' }

export default function AppLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()
  const signOut = useSignOut()

  useEnsureUser()

  if (!isSignedIn) return <Redirect href="/" />

  return (
    <GroupProvider
      pending={<GroupPending />}
      none={<NoGroup onSignOut={signOut} />}
    >
      {/* Inside both gates, because the chooser needs the Group and needs this
          stack to be pushed onto. The Drop itself was captured further up. */}
      <DropGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="deep-link" />
        <Stack.Screen name="drop" />
      </Stack>
    </GroupProvider>
  )
}
