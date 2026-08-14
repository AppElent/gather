/**
 * The root of the app, and the answer to the cold-start question.
 *
 * ## Why the router is not mounted straight away
 *
 * On a cold start Clerk has to read the session token out of the keychain and
 * exchange it before it can say whether anyone is signed in. That takes a few
 * hundred milliseconds, and for the whole of it `useAuth().isSignedIn` is
 * `undefined`. Mount the router into that window and the first thing a person
 * with a perfectly good session sees is the welcome screen, which then vanishes
 * — the "flash" #147 asks us not to have.
 *
 * So the tree below renders **nothing** until Clerk has resolved, and the native
 * splash is held over the gap with `preventAutoHideAsync()`. The first screen
 * the router ever mounts is therefore the correct one, and it hides the splash
 * itself once it has laid out (`useHideSplash`) — hiding it from here would
 * uncover a frame of empty background while the redirect resolves.
 *
 * ## Why there is a timeout
 *
 * A held splash with no escape hatch is a hang. If Clerk cannot be reached —
 * aeroplane mode, a dead instance — `isLoaded` never flips and the app is a
 * static image forever. After `SPLASH_TIMEOUT_MS` we give up on the splash and
 * show `<AuthUnavailable>` instead, which says what is happening and gets
 * replaced automatically if Clerk turns up late.
 */
import { useEffect, useState } from 'react'
import { LogBox } from 'react-native'
import { ClerkProvider, useAuth } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthUnavailable } from '../src/components/AuthUnavailable'
import { publishableKey } from '../src/auth/config'
import { LocaleProvider } from '../src/i18n'

/** How long a held splash is patience, after which it is a hang. */
const SPLASH_TIMEOUT_MS = 4000

// Clerk warns, on every reload, that the key is a development one. It is, on
// purpose, and the warning covers the whole screen in the dev client. Silenced
// by exact prefix so that any *other* Clerk warning still gets through.
LogBox.ignoreLogs(['Clerk: Clerk has been loaded with development keys'])

SplashScreen.preventAutoHideAsync()

// Expo Go substitutes its own splash and refuses `setOptions`, warning loudly
// each launch. Holding and hiding still work there — only the fade does not —
// so the guard keeps the dev loop quiet without changing behaviour anywhere the
// call is honoured. Remove it when the phone moves to a dev build.
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ duration: 220, fade: true })
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <LocaleProvider>
        <SafeAreaProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </LocaleProvider>
    </ClerkProvider>
  )
}

function RootNavigator() {
  const { isLoaded } = useAuth()
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (isLoaded) return
    const id = setTimeout(() => setGaveUp(true), SPLASH_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [isLoaded])

  // Still behind the splash. Rendering nothing is the point.
  if (!isLoaded && !gaveUp) return null

  if (!isLoaded) return <AuthUnavailable />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}
