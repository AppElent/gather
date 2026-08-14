/**
 * The appearance the app is in, and the one thing on the phone that overrules
 * the phone.
 *
 * The rule itself — what a stored value means, and what `system` resolves to —
 * is `@gather/core/appearance`, so it is asserted in the Node seam rather than
 * on a device (#159). What is left here is the three things only a client can
 * do: read the stored choice before the first frame, persist a new one, and
 * tell the platform.
 *
 * ## Why the choice is pushed into the platform as well as into a context
 *
 * The context is what `useTokens` reads, and it is enough for everything Gather
 * draws itself. It is not enough for everything on screen: the keyboard, the
 * text-selection handles, the native sheet's grabber and the tab bar are drawn
 * by the platform from the platform's own idea of the scheme. Leave that idea
 * alone and somebody who chose dark on a light phone gets a dark app with a
 * white keyboard.
 *
 * So `Appearance.setColorScheme` moves the platform's answer too, and `system`
 * is expressed by handing it back `'unspecified'` — React Native's word for
 * "no override", not for a third scheme. The two then agree by construction:
 * `useColorScheme()` returns the forced value, which `resolveScheme` maps to
 * the same scheme it was forced to.
 *
 * The context is still the source of truth rather than a mirror of the
 * platform, and that is deliberate: `setColorScheme` lands a frame later, and
 * the frame it lands after is the cold start that has to already be dark.
 *
 * ## Why it sits outside Clerk and Convex
 *
 * Appearance is a property of this phone, not of the account or of the service
 * (#159, user story 21: local appearance and language controls stay usable when
 * Gather cannot be reached). Nothing here waits on a session, so nothing here
 * is inside one — the Unavailable gate is drawn in the scheme its reader chose.
 */
import {
  type AppearancePreference,
  appearancePreference,
  type ColorScheme,
  resolveScheme,
} from '@gather/core/appearance'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Appearance, useColorScheme } from 'react-native'

import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'

export type { AppearancePreference, ColorScheme }
export { APPEARANCE_PREFERENCES } from '@gather/core/appearance'

interface AppearanceValue {
  /** What somebody chose, which is what the Settings control shows selected. */
  preference: AppearancePreference
  /** What is actually drawn. `system` has already been resolved away. */
  scheme: ColorScheme
  setPreference: (next: AppearancePreference) => void
}

const AppearanceContext = createContext<AppearanceValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  // Read once, synchronously, before the first paint. An awaited read would
  // mean a light frame on every cold start of a phone somebody set to dark.
  const [preference, setStored] = useState(() =>
    appearancePreference(readPreference(PREFERENCE_KEYS.appearance)),
  )
  const system = useColorScheme()
  const scheme = resolveScheme(preference, system)

  const setPreference = useCallback((next: AppearancePreference) => {
    setStored(next)
    writePreference(PREFERENCE_KEYS.appearance, next)
  }, [])

  useEffect(() => {
    Appearance.setColorScheme(
      preference === 'system' ? 'unspecified' : preference,
    )
  }, [preference])

  const value = useMemo<AppearanceValue>(
    () => ({ preference, scheme, setPreference }),
    [preference, scheme, setPreference],
  )

  return <AppearanceContext value={value}>{children}</AppearanceContext>
}

/**
 * Throws outside the provider rather than assuming light — a screen drawn in
 * the wrong scheme is a wiring bug, and silently getting the light palette is
 * how it would survive review.
 */
export function useAppearance(): AppearanceValue {
  const value = use(AppearanceContext)
  if (!value) {
    throw new Error('useAppearance must be used within an AppearanceProvider')
  }
  return value
}
