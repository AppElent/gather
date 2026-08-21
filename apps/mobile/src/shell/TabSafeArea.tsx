/**
 * Safe-area insets measured at the tab screen rather than at the window.
 *
 * ## The bug this exists for
 *
 * There is one `SafeAreaProvider`, at the app's root, and its view is the whole
 * window. So `useSafeAreaInsets()` anywhere in the app answers the same
 * question: what does the *window* have at its edges — the notch, the home
 * indicator. On Android that is the whole story, because the tab bar is a
 * sibling view and the screen simply ends above it.
 *
 * On iOS it is not. The native tab bar is translucent and the screen is drawn
 * underneath it, and UIKit's answer to that is `additionalSafeAreaInsets` on
 * the tab controller's child — which is to say, the tab bar's height is part of
 * the safe area **of the screen**, and of nothing above it. A window-level
 * reading cannot see it. That is why the Baby log's bottom bar sat behind the
 * tab bar: it was leaving room for a 34pt home indicator on a screen whose
 * bottom 83pt were spoken for.
 *
 * A provider renders a native view and reports that view's own insets, so
 * nesting one here — inside the tab, around the tab's stack — is what makes
 * every screen below it read its own edges instead of the window's. Nothing in
 * those screens changes: they go on asking for `insets.bottom` and now get an
 * answer that accounts for what is actually covering them.
 *
 * ## Why `initialMetrics`
 *
 * A `SafeAreaProvider` renders nothing until it has measured itself, which is
 * one blank frame every time a tab mounts. Seeding it with the values from the
 * provider above means it starts with the window's answer — right on Android,
 * an underestimate on iOS for exactly one frame — and corrects itself on
 * layout, instead of starting with nothing. This is what react-navigation does
 * for the same reason.
 */
import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import {
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

export function TabSafeArea({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()

  return (
    <SafeAreaProvider initialMetrics={{ insets, frame }} style={styles.fill}>
      {children}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
