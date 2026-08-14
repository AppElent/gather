/**
 * Where the phone remembers which Group it was last in.
 *
 * **Local, and synchronous.** Local because a Group stored on the `users` row is
 * the model ADR-0002 deleted, and would let the phone silently change what the
 * web's shell defaults to; synchronous because the first frame after a cold
 * start has to be drawn in the right Group, and an awaited read means a frame in
 * the wrong one. `expo-sqlite/kv-store` is the store #140 chose for the locale
 * for exactly that property, so there is one persistence mechanism here rather
 * than two.
 *
 * Best-effort in both directions: a store that will not open is a phone that
 * forgets where it was, which is a fallback (ADR-0015), not an error.
 *
 * The `try` blocks cover reading and writing, not the import. `expo-sqlite` is a
 * native module, so a client whose native side predates it throws on load and
 * there is no handler that could catch that — **the dev client has to be rebuilt
 * for this dependency**, exactly as it did for `expo-secure-store`. Expo Go
 * bundles it already.
 *
 * What is stored is a *slug*, not an id. It is the same thing the web's address
 * bar carries, so a deep link and a retained selection say the Group the same
 * way, and it is legible in a debugger.
 */
import Storage from 'expo-sqlite/kv-store'

const KEY = 'gather:group:retained'

/** The slug the app was last in, or null if it has never been anywhere. */
export function readRetainedGroup(): string | null {
  try {
    return Storage.getItemSync(KEY)
  } catch {
    return null
  }
}

export function writeRetainedGroup(slug: string) {
  try {
    Storage.setItemSync(KEY, slug)
  } catch {
    // ignore — the next launch just lands on the landing Group
  }
}

/**
 * Forget the retained Group. Sign-out's job: the next person to sign in on this
 * phone must not open in the last person's household, and a slug that is not
 * theirs would be rejected on read anyway — silently, and one round-trip late.
 */
export function clearRetainedGroup() {
  try {
    Storage.removeItemSync(KEY)
  } catch {
    // ignore — a stale slug is validated against the Member's Groups on read
  }
}
