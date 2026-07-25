const PREFIX = 'gather:baby:lastUsed:'

/** Small localStorage-backed memory for repetitive form choices (e.g. "how
 * was the temperature taken") so they don't need reselecting every entry.
 * Best-effort: unavailable storage (SSR, private browsing quota) just means
 * no default, never an error. */
export function readLastUsed(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeLastUsed(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, value)
  } catch {
    // ignore — private browsing / storage quota
  }
}
