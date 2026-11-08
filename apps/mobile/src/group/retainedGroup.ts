/**
 * Where the phone remembers which Group it was last in.
 *
 * The store itself, and why it is local and synchronous, is
 * `prefs/localPreference.ts`, shared with appearance and language.
 *
 * What is left here is the part that is about a Group: what is stored is the
 * Group's *id* — the same thing `setGroup` takes and `selectGroup` validates.
 * A slug is not a Group's identity (ADR-0031); an old `/g/<slug>` link is
 * resolved to an id before anything is retained.
 */
import {
  clearPreference,
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'

/** The id of the Group the app was last in, or null if it has never been anywhere. */
export function readRetainedGroup(): string | null {
  return readPreference(PREFERENCE_KEYS.group)
}

export function writeRetainedGroup(groupId: string) {
  writePreference(PREFERENCE_KEYS.group, groupId)
}

/**
 * Forget the retained Group. Sign-out's job: the next person to sign in on this
 * phone must not open in the last person's household, and an id that is not
 * theirs would be rejected on read anyway — silently, and one round-trip late.
 *
 * Appearance and language are deliberately *not* forgotten with it. They are
 * properties of the phone rather than of the account, and somebody signing back
 * in should not have to set the app dark again.
 */
export function clearRetainedGroup() {
  clearPreference(PREFERENCE_KEYS.group)
}
