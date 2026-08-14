/**
 * Behind the door.
 *
 * The guard is Clerk's `isSignedIn`, not Convex's `isAuthenticated`, and that is
 * not interchangeable: the two disagree for the length of the JWT handshake
 * after a sign-in, and guarding on the Convex side produces an infinite bounce
 * between the two halves of the app. The web learned this the hard way; the
 * phone starts on the right side of it.
 *
 * There is no Convex here yet at all — wiring it is #138's ticket. This layout
 * is the seam that ticket will widen.
 */
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@clerk/expo'

import { useTokens } from '../../src/theme/tokens'

export default function AppLayout() {
  const { isSignedIn } = useAuth()
  const tokens = useTokens()

  if (!isSignedIn) return <Redirect href="/" />

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    />
  )
}
