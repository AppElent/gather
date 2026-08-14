/**
 * Where the phone remembers the three things it must know before it can draw a
 * frame: which Group it was in, how it should look, and what language to speak.
 *
 * **Local, and synchronous.** Local because none of the three is service data —
 * the retained Group is this phone's memory rather than a property of the
 * Member (ADR-0002/ADR-0015), and appearance and language are settings a person
 * must still be able to change when Gather cannot be reached at all (#159,
 * user story 21). Synchronous because the first frame after a cold start has to
 * be the right one: an awaited read means a frame in the wrong Group, or a
 * flash of light before the dark somebody chose.
 *
 * `expo-sqlite/kv-store` is the one store, chosen in #140 for exactly that
 * property. One mechanism, three keys, rather than a persistence library per
 * preference.
 *
 * Best-effort in both directions: a store that will not open is a phone that
 * forgets a preference, which is a fallback, not an error. Every reader here
 * treats `null` as "never chosen", so forgetting lands on the same defaults a
 * fresh install has.
 *
 * The `try` blocks cover reading and writing, not the import. `expo-sqlite` is
 * a native module, so a client whose native side predates it throws on load and
 * there is no handler that could catch that — **the dev client has to be
 * rebuilt for this dependency**, exactly as it did for `expo-secure-store`.
 * Expo Go bundles it already.
 */
import Storage from 'expo-sqlite/kv-store'

/**
 * Namespaced so that the store stays legible in a debugger and a future key
 * cannot collide with a library's.
 */
export const PREFERENCE_KEYS = {
  group: 'gather:group:retained',
  appearance: 'gather:appearance',
  locale: 'gather:locale',
} as const

export type PreferenceKey =
  (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS]

/** What was stored under this key, or null if nothing readable was. */
export function readPreference(key: PreferenceKey): string | null {
  try {
    return Storage.getItemSync(key)
  } catch {
    return null
  }
}

export function writePreference(key: PreferenceKey, value: string) {
  try {
    Storage.setItemSync(key, value)
  } catch {
    // ignore — the next launch falls back to this preference's default
  }
}

export function clearPreference(key: PreferenceKey) {
  try {
    Storage.removeItemSync(key)
  } catch {
    // ignore — every reader validates what it gets back anyway
  }
}
