/**
 * Where the phone remembers which Group it was last in.
 *
 * The store itself, and why it is local and synchronous, is
 * `prefs/localPreference.ts` — the retained Group was the first of the three
 * preferences that live there, and appearance and language joined it in #164
 * rather than each bringing its own persistence.
 *
 * What is left here is the part that is about a Group: what is stored is a
 * *slug*, not an id. It is the same thing the web's address bar carries, so a
 * deep link and a retained selection say the Group the same way, and it is
 * legible in a debugger.
 */
import {
  clearPreference,
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'

/** The slug the app was last in, or null if it has never been anywhere. */
export function readRetainedGroup(): string | null {
  return readPreference(PREFERENCE_KEYS.group)
}

export function writeRetainedGroup(groupId: string) {
  writePreference(PREFERENCE_KEYS.group, groupId)
}

/**
 * Forget the retained Group. Sign-out's job: the next person to sign in on this
 * phone must not open in the last person's household, and a slug that is not
 * theirs would be rejected on read anyway — silently, and one round-trip late.
 *
 * Appearance and language are deliberately *not* forgotten with it. They are
 * properties of the phone rather than of the account, and somebody signing back
 * in should not have to set the app dark again.
 */
export function clearRetainedGroup() {
  clearPreference(PREFERENCE_KEYS.group)
}
