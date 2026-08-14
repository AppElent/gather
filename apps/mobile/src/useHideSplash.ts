/**
 * Hands the screen back from the native splash.
 *
 * Returns an `onLayout` handler rather than running in an effect, because an
 * effect fires when the component has committed and a layout callback fires
 * when it has actually been measured and positioned. The difference is one
 * frame of blank background, which is exactly the artefact the held splash
 * exists to prevent.
 *
 * Every screen that can be the *first* one mounted calls this: the welcome, the
 * signed-in landing, and the auth-unavailable gate. `hideAsync()` after the
 * splash is already gone is a no-op, so a second caller costs nothing.
 */
import { useCallback } from 'react'
import * as SplashScreen from 'expo-splash-screen'

export function useHideSplash() {
  return useCallback(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden, or never shown. Neither is worth a crash.
    })
  }, [])
}
