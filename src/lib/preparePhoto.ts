/**
 * Turning a chosen file into the photo Gather actually stores (ADR-0010).
 *
 * Two steps, kept apart because they fail for different reasons and at
 * different moments. `decodePhoto` runs when the file is chosen — it is what
 * says whether this browser can read this image at all, and it decides the
 * pixel space the person then frames in. `preparePhoto` runs when they confirm,
 * and is the only thing that produces bytes to upload.
 *
 * Neither has a fallback to the original file, and that is the point. A HEIC
 * that Chrome cannot decode is refused; uploading it untouched instead would
 * quietly retire the size guarantee on some browsers only, leaving nothing in
 * the data to say which rows came through which door.
 */

import type { CropRect, Size } from './cropFrame'
import type { PhotoPreset } from './photoPresets'

/**
 * The only output format.
 *
 * `canvas.toBlob` falls back to `image/png` *silently* when asked for a type
 * the browser cannot encode, and a 1600px PNG is bigger than the JPEG we were
 * shrinking. JPEG is universally supported, so asking for it is safe — and
 * `renderPhoto` checks what came back anyway, because a silent fallback that
 * inflates storage is exactly the kind of failure nobody would notice.
 */
export const PREPARED_PHOTO_TYPE = 'image/jpeg'

/** Sentences a person is meant to read, not diagnostics. */
export const PHOTO_DECODE_ERROR =
  'That image could not be opened in this browser. Try saving it as a JPEG and choosing it again.'
export const PHOTO_PREPARE_ERROR =
  'That image could not be prepared. Try a smaller photo, or save it as a JPEG and choose it again.'

/**
 * A decoded image, upright, with the dimensions the person frames against.
 *
 * `close` releases the decoded bitmap; a 4032×3024 photo is ~48MB of RGBA, and
 * a person who opens and abandons the crop editor a few times would otherwise
 * be carrying every one of them.
 */
export interface DecodedPhoto extends Size {
  readonly source: CanvasImageSource
  close: () => void
}

export interface PreparedPhoto extends Size {
  readonly blob: Blob
}

/**
 * Decode a chosen file, upright.
 *
 * `imageOrientation: 'from-image'` is the entire EXIF story and the single most
 * likely defect in this feature if it goes missing: a phone photo carries its
 * rotation as a tag rather than in the pixels, and a canvas draws what the
 * pixels say. Without the flag every portrait photo is stored on its side. It
 * is asserted in the tests for this module rather than left to be noticed in
 * production.
 *
 * Re-encoding from a decoded bitmap also drops EXIF entirely, which is wanted
 * for its own sake: photos currently reach storage carrying the GPS
 * coordinates where they were taken, and `getUrl` serves them onward.
 */
export async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error(PHOTO_DECODE_ERROR)
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(PHOTO_DECODE_ERROR)
  }
  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close()
    throw new Error(PHOTO_DECODE_ERROR)
  }
  return {
    width: bitmap.width,
    height: bitmap.height,
    source: bitmap,
    close: () => bitmap.close(),
  }
}

/**
 * How large the framed region is stored.
 *
 * Scales the longest edge down to the preset's limit and never up: a photo
 * already smaller than the preset is stored at the size it is, rather than
 * gaining pixels it has no information for. The height is derived from the
 * rounded scale of both edges, so a square frame stays square.
 */
export function outputSize(crop: Size, maxEdge: number): Size {
  const longest = Math.max(crop.width, crop.height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  return {
    width: Math.min(maxEdge, Math.max(1, Math.round(crop.width * scale))),
    height: Math.min(maxEdge, Math.max(1, Math.round(crop.height * scale))),
  }
}

/** Draw the framed region at the output size and encode it as a JPEG. */
async function renderPhoto(
  photo: DecodedPhoto,
  crop: CropRect,
  size: Size,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(PHOTO_PREPARE_ERROR)

  let blob: Blob | null
  try {
    context.drawImage(
      photo.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    )
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, PREPARED_PHOTO_TYPE, quality)
    })
  } catch {
    throw new Error(PHOTO_PREPARE_ERROR)
  }
  // A `null` blob is a decode that ran out of memory; a blob of some other type
  // is `toBlob`'s silent PNG fallback. Both are refusals, not uploads.
  if (!blob || blob.type !== PREPARED_PHOTO_TYPE) {
    throw new Error(PHOTO_PREPARE_ERROR)
  }
  return blob
}

/**
 * The photo that gets stored: the framed region, shrunk to the preset, as a
 * JPEG carrying no metadata.
 */
export async function preparePhoto(
  photo: DecodedPhoto,
  crop: CropRect,
  preset: PhotoPreset,
): Promise<PreparedPhoto> {
  const size = outputSize(crop, preset.maxEdge)
  const blob = await renderPhoto(photo, crop, size, preset.quality)
  return { blob, width: size.width, height: size.height }
}
