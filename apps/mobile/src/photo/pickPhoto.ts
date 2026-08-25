/**
 * Getting a photo off the phone and into Convex storage.
 *
 * Four decisions live here, and they are the ones that make an image upload
 * either fine or a slow, expensive mess. It sat inside the Baby log until
 * Recipes wanted the same thing — the second real case ADR-0022 said to wait
 * for — and nothing about it was ever a Memory's.
 *
 * ## It is prepared before it leaves the phone (ADR-0010)
 *
 * A photo off a modern camera is 3–8 MB and 4000px on the long edge. Nothing
 * in this app ever renders one larger than a phone screen, so uploading the
 * original spends a person's mobile data and the household's storage on
 * detail no screen will show. The numbers are not written here: the caller
 * names a preset from `@gather/core/photo-presets`, which is the one table
 * allowed to hold a dimension, and which the web prepares against too.
 *
 * What this does *not* do is offer a crop, whatever the preset's `aspect`
 * says. ADR-0010 asks for a framing step because the prepared photo is the
 * only copy — but that argument is about a child's avatar, a 56px circle
 * somebody had better choose the middle of. A memory and a recipe are the
 * opposite: the whole picture is the point, and it was framed by whoever took
 * it. `expo-image-picker`'s editor also forces a square on iOS, so "letting
 * the person frame it" would in practice mean squaring every photo taken on a
 * phone. Resize and re-encode, nothing else — and both presets the phone uses
 * are free-framed, so nothing is being quietly overridden.
 *
 * ## The bytes go up before the row exists
 *
 * Convex's upload is a three-step handshake — ask for a URL, POST to it, get
 * a storage id back — and only the third step produces something a mutation
 * can take. So the mutation is called *with* the id, never patched
 * afterwards. A save that gets as far as the mutation has its picture; a save
 * whose upload failed never became a row at all. That is the whole reason
 * this blocks rather than attaching in the background: a half-attached photo
 * is a sync problem, and the photo is optional everywhere it is offered, so
 * "save without it" is always available.
 *
 * The cost is an orphan: bytes uploaded for a save that is then abandoned sit
 * in storage referenced by nothing. That is #41, and it is the same hole the
 * web's recipe and food images already have. Recipes' review-before-save
 * import makes abandoning the *expected* way to reject a bad parse, so the
 * hole is now reachable on purpose rather than only by accident.
 *
 * ## The URL it ends up with is public
 *
 * `ctx.storage.getUrl` returns an unguessable but unauthenticated URL —
 * anyone holding the link can fetch the image, and it does not expire. Gather
 * already accepts that for a child's photo and for every recipe picture the
 * web has ever stored. It would not be acceptable for a medical record, and
 * nothing that goes through here is one.
 *
 * ## Permission is a refusal, not an error
 *
 * A person who declines the camera has not hit a failure — they have
 * answered. `'denied'` comes back as a value so the caller can say what it
 * needs rather than showing "could not add that photo".
 */
import { type PhotoPresetName, photoPreset } from '@gather/core/photo-presets'
import { File, UploadType } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

export type PhotoSource = 'camera' | 'library'

/** A local file, already downscaled, ready to upload. */
export interface PickedPhoto {
  uri: string
  width: number
  height: number
}

/**
 * Ask for a photo, then shrink it to what the preset allows.
 *
 * `null` is "changed their mind" — the picker was cancelled — and `'denied'`
 * is "said no to the permission". Both are ordinary answers, neither is a
 * failure, and only a genuine problem throws.
 */
export async function pickPhoto(
  source: PhotoSource,
  preset: PhotoPresetName,
): Promise<PickedPhoto | null | 'denied'> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'

  const { maxEdge, quality } = photoPreset(preset)

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    // See the note at the top: the editor is square-only on iOS, and neither
    // a memory nor a plate of food is a square.
    allowsEditing: false,
    // Applied to whatever the picker itself hands back; the real reduction is
    // the prepare step below, which this cannot do.
    quality,
    // Location and camera model are not ours to store, and nothing in Gather
    // reads them.
    exif: false,
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled) return null

  const picked = result.assets[0]
  if (!picked) return null
  return await downscale(picked.uri, picked.width, picked.height, {
    maxEdge,
    quality,
  })
}

/**
 * Prepare a photo that arrived rather than one somebody picked.
 *
 * A Drop hands over a local file the OS wrote into a shared container, with no
 * picker and therefore no permission step and no dimensions worth trusting — a
 * share intent reports them as null often enough that believing one would
 * sometimes skip the resize entirely. Rendering once to measure costs a decode
 * and removes the guess.
 *
 * Everything after that is the same as a picked photo, deliberately: ADR-0010
 * says a stored photo is prepared and never stored as chosen, and a photo that
 * arrived through the share sheet is no more "as chosen" than one off the
 * camera roll. Same preset table, same cap, same JPEG.
 */
export async function preparePhoto(
  uri: string,
  preset: PhotoPresetName,
): Promise<PickedPhoto> {
  const { maxEdge, quality } = photoPreset(preset)
  const { width, height } = await ImageManipulator.manipulate(uri).renderAsync()
  return await downscale(uri, width, height, { maxEdge, quality })
}

/**
 * Cap the long edge, re-encode as JPEG.
 *
 * Only the long edge is given, so the other is computed from the ratio and a
 * portrait photo does not come back square. An image already inside the cap
 * is still re-encoded, because a 12 MB lossless PNG under 1600px is exactly
 * the case that looks small and is not.
 */
async function downscale(
  uri: string,
  width: number,
  height: number,
  { maxEdge, quality }: { maxEdge: number; quality: number },
): Promise<PickedPhoto> {
  const longEdge = Math.max(width, height)
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
  const context = ImageManipulator.manipulate(uri)
  if (scale < 1) context.resize({ width: Math.round(width * scale) })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({
    compress: quality,
    format: SaveFormat.JPEG,
  })
  return { uri: saved.uri, width: saved.width, height: saved.height }
}

/**
 * Put the bytes in Convex storage and answer with the id the mutation wants.
 *
 * The upload URL is single-use and comes from whichever Module's door the
 * caller passed in — `babies.generateUploadUrl`, `recipes.generateUploadUrl`.
 * Each checks only that somebody is signed in, which is enough: the id is
 * worthless without a mutation that will accept it, and every mutation that
 * does has already refused whoever may not write the row.
 */
export async function uploadPhoto(
  uri: string,
  uploadUrl: string,
): Promise<string> {
  // `expo-file-system`, not `fetch(uri)`. The web reads a local file by
  // fetching its URL; React Native's `fetch` does not implement the `file://`
  // scheme at all and answers a 14-byte body reading "File not found", which
  // then uploads cleanly as a corrupt image. It has to be read natively.
  const result = await new File(uri).upload(uploadUrl, {
    httpMethod: 'POST',
    uploadType: UploadType.BINARY_CONTENT,
    // Convex reads the stored file's type from this header and rejects the
    // request outright if it is empty. `downscale` always writes JPEG.
    headers: { 'Content-Type': 'image/jpeg' },
  })
  // A non-2xx resolves rather than throwing, so the status is ours to check.
  if (result.status < 200 || result.status >= 300)
    throw new Error(`Upload failed: ${result.status}`)
  const { storageId } = JSON.parse(result.body) as { storageId: string }
  return storageId
}
