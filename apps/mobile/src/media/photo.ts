/**
 * Getting a photo off the phone and into Convex storage, for any Module.
 *
 * Lifted out of the Baby log when the tasting Modules needed the same thing
 * (#199). The four decisions the Baby log wrote down are unchanged and are the
 * reason this is one file rather than one per Module:
 *
 * ## It is prepared before it leaves the phone (ADR-0010)
 *
 * A photo off a modern camera is 3–8 MB and 4000px on the long edge, and
 * nothing in this app ever renders one larger than a phone screen. The numbers
 * are **not** written here: the caller names a preset from
 * `@gather/core/photo-presets`, which is the one table allowed to hold a
 * dimension and which the web prepares against too. Adding a fourth preset is
 * a change there, never a number passed in here.
 *
 * ## The bytes go up before the row exists
 *
 * Convex's upload is a three-step handshake and only the third step produces
 * something a mutation can take, so the storage id is passed *into* the
 * mutation and never patched on afterwards. A save whose upload failed never
 * became a row. The cost is an orphan when somebody abandons the form (#41),
 * which is the same hole the web's recipe and food images have.
 *
 * ## No crop, and that is a decision per preset rather than per Module
 *
 * `expo-image-picker`'s editor forces a square on iOS, so offering "framing"
 * would in practice square every photo. A preset with a locked `aspect` wants
 * a real framing step and does not have one here yet; the two callers today
 * (`memoryPhoto`, `recipePhoto`) are both free-framed, and this throws rather
 * than silently squaring anything else.
 *
 * ## Permission is a refusal, not an error
 *
 * A person who declines the camera has answered, not failed. `'denied'` comes
 * back as a value so the caller can say what it needs.
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
 * Ask for a photo, then shrink it to the named preset.
 *
 * `null` is "changed their mind" — the picker was cancelled — and `'denied'`
 * is "said no to the permission". Both are ordinary answers; only a genuine
 * problem throws.
 */
export async function pickPhoto(
  preset: PhotoPresetName,
  source: PhotoSource,
): Promise<PickedPhoto | null | 'denied'> {
  const settings = photoPreset(preset)
  if (settings.aspect !== null) {
    throw new Error(
      `${preset} locks its frame, and no framing step exists on the phone`,
    )
  }

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    // Applied to whatever the picker hands back; the real reduction is the
    // prepare step below, which this cannot do.
    quality: settings.quality,
    // Location and camera model are not ours to store, and nothing reads them.
    exif: false,
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options)
  if (result.canceled) return null

  const picked = result.assets[0]
  if (!picked) return null
  return await downscale(preset, picked.uri, picked.width, picked.height)
}

/**
 * Cap the long edge, re-encode as JPEG.
 *
 * Only the long edge is given, so the other is computed from the ratio and a
 * portrait photo does not come back square. An image already inside the cap is
 * still re-encoded, because a 12 MB lossless PNG under 1600px is exactly the
 * case that looks small and is not.
 */
async function downscale(
  preset: PhotoPresetName,
  uri: string,
  width: number,
  height: number,
): Promise<PickedPhoto> {
  const { maxEdge, quality } = photoPreset(preset)
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
 * The upload URL is single-use and comes from the Module's own
 * `generateUploadUrl`, which checks only that somebody is signed in — the id
 * is worthless without a mutation that will accept it, and every mutation that
 * does has already refused whoever may not write the record.
 */
export async function uploadPhoto(
  uri: string,
  uploadUrl: string,
): Promise<string> {
  // `expo-file-system`, not `fetch(uri)`. React Native's `fetch` does not
  // implement the `file://` scheme at all and answers a 14-byte body reading
  // "File not found", which then uploads cleanly as a corrupt image.
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
