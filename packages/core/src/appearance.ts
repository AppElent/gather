/**
 * Light, dark, or whatever the phone is already in.
 *
 * The rule is four lines and the client that needs it has no test runner
 * (#159: mobile's automated gate is typechecking and linting), so it lives
 * here — dependency-free, in the Node seam, where "an unreadable stored value
 * means system" and "an explicit choice beats the device" are actually
 * asserted rather than accepted on a device.
 *
 * ## Why the stored word is `system` and not the web's `auto`
 *
 * The web's three-way control comes from `@appelent/auth`, whose `ThemeMode`
 * is `'light' | 'dark' | 'auto'`. That package is React-DOM only and never
 * crosses to the phone, and neither does the value: this preference is written
 * to the phone's own key-value store and read by nothing else, so the two
 * tokens never meet and there is nothing to reconcile.
 *
 * What the phone gains by saying `system` is that it is the word the platform
 * and the spec both use for it (#159, user story 16), and the word its own
 * Settings screen shows. ADR-0017 shares *words*, and the shared word for this
 * one is `system`. If the preference ever does have to travel — synced through
 * Clerk metadata, say — the mapping is one line at the boundary, which is the
 * right place for it.
 */

export const APPEARANCE_PREFERENCES = ['light', 'system', 'dark'] as const

/** What somebody chose. `system` is a choice, not the absence of one. */
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number]

/** What is actually drawn. There is no third scheme to draw. */
export type ColorScheme = 'light' | 'dark'

/**
 * The preference a store handed back, or `system` if it handed back anything
 * else. A store that has never been written, one written by an older build,
 * and one that failed to open are the same answer: follow the phone.
 */
export function appearancePreference(saved: unknown): AppearancePreference {
  return (
    APPEARANCE_PREFERENCES.find((candidate) => candidate === saved) ?? 'system'
  )
}

/**
 * The scheme to draw, given the choice and what the device says it is in.
 *
 * `systemScheme` is `useColorScheme()`'s return, and it is deliberately typed
 * as a loose string: React Native reports `'unspecified'` when the platform has
 * no preference to report and `null` on some versions, neither of which is a
 * third scheme to draw. Anything that is not `'dark'` is light, which is what
 * the tokens assume when nothing is known.
 */
export function resolveScheme(
  preference: AppearancePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference
  return systemScheme === 'dark' ? 'dark' : 'light'
}
