/**
 * Putting a picture on the account, which is the one photo in Gather that does
 * not go into Convex storage.
 *
 * Everything else the app uploads is a household's — a recipe's hero, a child's
 * face, a memory — and lands in `_storage` behind a Group. A profile picture is
 * the person's, follows them between Groups, and is already stored by the thing
 * that owns the account. So it goes to Clerk, and `storedFiles.ts` never has to
 * know about it.
 *
 * Two things are still shared with every other photo, and deliberately:
 *
 * - **It is prepared before it leaves the phone** (ADR-0010), against the
 *   `profilePhoto` preset in `@gather/core/photo-presets`. No dimension and no
 *   quality is written here.
 * - **The bytes are read with `expo-file-system`, never `fetch`.** React
 *   Native does not implement the `file://` scheme: `fetch(uri)` answers a
 *   14-byte body reading "File not found", which Clerk would then accept as a
 *   perfectly valid corrupt image.
 *
 * Clerk takes a `Blob`, a `File` or a string, and the string it means is a data
 * URI — which is what makes base64 the right read here rather than a detour
 * through a `Blob` React Native would have to build in memory anyway.
 */
import { File } from 'expo-file-system'

import { pickPhoto } from '../photo/pickPhoto'

export type ProfilePhotoAction = 'camera' | 'library' | 'remove'

/**
 * As much of Clerk's user as this needs. `@clerk/types` is not a dependency of
 * the phone — it arrives transitively — and naming the one method keeps this
 * callable from a test with no Clerk at all.
 */
export interface ProfileImageTarget {
  setProfileImage: (params: { file: string | null }) => Promise<unknown>
}

/**
 * `'ok'` when something changed, `'cancelled'` when they backed out, and
 * `'denied'` for a refused permission — which is an answer rather than a
 * failure and must not be reported as one.
 */
export type ProfilePhotoOutcome = 'ok' | 'cancelled' | 'denied' | 'failed'

export async function setProfilePhoto(
  user: ProfileImageTarget,
  action: ProfilePhotoAction,
): Promise<ProfilePhotoOutcome> {
  try {
    if (action === 'remove') {
      await user.setProfileImage({ file: null })
      return 'ok'
    }

    const picked = await pickPhoto(
      action === 'camera' ? 'camera' : 'library',
      'profilePhoto',
    )
    if (picked === 'denied') return 'denied'
    if (!picked) return 'cancelled'

    const base64 = await new File(picked.uri).base64()
    await user.setProfileImage({ file: `data:image/jpeg;base64,${base64}` })
    return 'ok'
  } catch {
    return 'failed'
  }
}
