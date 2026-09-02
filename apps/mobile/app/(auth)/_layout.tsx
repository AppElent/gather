/**
 * The signed-out half of the app.
 *
 * The redirect out of here is the one that matters for the cold start: by the
 * time this layout renders, `RootNavigator` has already waited for Clerk, so
 * `isSignedIn` is a real answer rather than `undefined`. A person with a cached
 * session is sent to `/home` on the first render, and the welcome screen below
 * never mounts — which is why the splash is not hidden from the root but from
 * whichever screen actually arrives.
 *
 * The header is a bare back chevron: the heading lives in the body of each
 * screen (see `AuthScreen`), and a header title as well would be the same words
 * twice.
 */

import { useAuth } from '@clerk/expo'
import { Redirect, Stack } from 'expo-router'

import { pendingGroupLink } from '../../src/shell/pendingGroupLink'
import { useTokens } from '../../src/theme/tokens'

export default function AuthLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()

  if (isSignedIn) {
    return <Redirect href={pendingGroupLink() ? '/deep-link' : '/home'} />
  }

  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.bg },
        headerTintColor: tokens.fg,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome-catalogue" options={{ headerShown: false }} />
    </Stack>
  )
}
