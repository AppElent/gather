/**
 * Everything on screen that Gather does not draw itself.
 *
 * Three surfaces sit outside the React tree's styling and each has to be told
 * the scheme separately, which is why they are together here rather than
 * scattered across the screens that happen to be under them:
 *
 * - **Native headers and screen backgrounds.** Expo Router mounts its own
 *   `ThemeProvider` with `DefaultTheme` — the light one — and never consults
 *   the device, so without this every pushed screen's header is white in dark
 *   mode. Our provider is *inside* that one and therefore wins for the whole
 *   app. The theme is built from the same tokens the screens use, so a header
 *   and the screen under it cannot disagree.
 * - **The status bar.** Set from the resolved scheme rather than left on
 *   `auto`, because `auto` reads the device and the device is no longer the
 *   only thing that decides (see `theme/appearance.tsx`).
 * - **The window behind the tree.** The root view keeps its launch colour
 *   otherwise, which shows through as a pale band under a dark app while a
 *   keyboard dismisses or the device rotates.
 */
import { DarkTheme, DefaultTheme, type Theme, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { type ReactNode, useEffect } from 'react'

import { type Tokens, useTokens } from './tokens'

/**
 * Exported for the same reason `useTokens` is a hook rather than a constant:
 * the mapping from Gather's palette to the six colours the navigator knows
 * about is a fact about the palette, not about any one screen.
 */
export function navigationTheme(tokens: Tokens): Theme {
  const base = tokens.scheme === 'dark' ? DarkTheme : DefaultTheme
  return {
    ...base,
    colors: {
      ...base.colors,
      // The header's back chevron and title tint. Ink, not a Module tint: the
      // shell belongs to no Module (ADR-0017's accent rule).
      primary: tokens.accent,
      background: tokens.bg,
      card: tokens.surface,
      text: tokens.fg,
      border: tokens.border,
      notification: tokens.danger,
    },
  }
}

export function NativeChrome({ children }: { children: ReactNode }) {
  const tokens = useTokens()
  const theme = navigationTheme(tokens)

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(tokens.bg)
  }, [tokens.bg])

  return (
    <ThemeProvider value={theme}>
      {children}
      <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  )
}
