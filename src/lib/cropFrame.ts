/**
 * The rectangle a person frames a photo with, in the decoded image's own
 * pixels.
 *
 * Every number here is a source pixel, never a screen pixel. The crop editor
 * draws the frame as a percentage of whatever box the preview happens to
 * occupy, and converts a drag back into source pixels before it gets here, so
 * the frame means the same thing on a phone and on a wide screen and the
 * arithmetic below never has to know which it is running on.
 *
 * The invariant these functions exist to hold is that a locked aspect stays
 * locked. A child's photo is stored square because the frame cannot be dragged,
 * scaled, or clamped into a non-square — including at the edges of the image,
 * which is where a naive clamp per axis quietly breaks it (ADR-0010).
 */

export interface Size {
  readonly width: number
  readonly height: number
}

export interface CropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * The smallest frame a person can shrink to, in source pixels.
 *
 * Small enough to crop a face out of a group photo, large enough that a
 * fumbled drag cannot leave a frame with no pixels in it. Images smaller than
 * this are allowed to be smaller than this — the floor never grows a frame past
 * the image containing it.
 */
const MIN_CROP_PX = 32

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Width ÷ height a frame should hold: the preset's, or the frame's own. */
function aspectOf(crop: CropRect, aspect: number | null): number {
  return aspect ?? crop.width / crop.height
}

/** The largest frame of `aspect` that fits inside the image, as a width. */
function maxWidthFor(image: Size, aspect: number): number {
  return Math.min(image.width, image.height * aspect)
}

/**
 * The frame a photo opens with.
 *
 * A free frame encloses the whole image, so confirming it untouched crops
 * nothing — the recipe preset relies on that. A locked frame is the largest one
 * that fits, centred, which is the most of the photo the person can keep and
 * the least presumptuous starting point we can offer.
 */
export function initialCrop(image: Size, aspect: number | null): CropRect {
  if (aspect === null) {
    return { x: 0, y: 0, width: image.width, height: image.height }
  }
  const width = Math.round(maxWidthFor(image, aspect))
  const height = Math.round(width / aspect)
  return {
    x: Math.round((image.width - width) / 2),
    y: Math.round((image.height - height) / 2),
    width,
    height,
  }
}

/** Slide the frame by a delta in source pixels, keeping it inside the image. */
export function moveCrop(crop: CropRect, image: Size, dx: number, dy: number) {
  return {
    ...crop,
    x: Math.round(clamp(crop.x + dx, 0, Math.max(0, image.width - crop.width))),
    y: Math.round(
      clamp(crop.y + dy, 0, Math.max(0, image.height - crop.height)),
    ),
  }
}

/**
 * Drag the frame's bottom-right corner by a delta in source pixels.
 *
 * The top-left stays put, so the room available is whatever lies below and to
 * the right of it. Under a locked aspect the two axes cannot be clamped
 * independently — the binding one decides the width and the other follows from
 * it — which is the whole reason this is not two `clamp` calls.
 */
export function resizeCrop(
  crop: CropRect,
  image: Size,
  aspect: number | null,
  dx: number,
  dy: number,
): CropRect {
  const ratio = aspectOf(crop, aspect)
  const roomWidth = image.width - crop.x
  const roomHeight = image.height - crop.y

  if (aspect === null) {
    const width = clamp(
      Math.round(crop.width + dx),
      Math.min(MIN_CROP_PX, roomWidth),
      roomWidth,
    )
    const height = clamp(
      Math.round(crop.height + dy),
      Math.min(MIN_CROP_PX, roomHeight),
      roomHeight,
    )
    return { ...crop, width, height }
  }

  // One drag, two axes, one degree of freedom: whichever axis the person moved
  // furthest is the one they meant.
  const wanted =
    Math.abs(dy) > Math.abs(dx) ? crop.width + dy * ratio : crop.width + dx
  const maxWidth = Math.min(roomWidth, roomHeight * ratio)
  return withWidth(crop, wanted, maxWidth, ratio)
}

/**
 * Set the frame's size to a fraction of the largest one that would fit,
 * keeping its centre where it is.
 *
 * This is what the size slider drives. A slider is not a nicety next to the
 * corner handle: dragging a corner is the only other way to resize, and it is
 * unavailable to anyone working by keyboard.
 */
export function scaleCrop(
  crop: CropRect,
  image: Size,
  aspect: number | null,
  fraction: number,
): CropRect {
  const ratio = aspectOf(crop, aspect)
  const maxWidth = maxWidthFor(image, ratio)
  const sized = withWidth(
    crop,
    maxWidth * clamp(fraction, 0, 1),
    maxWidth,
    ratio,
  )
  const centreX = crop.x + crop.width / 2
  const centreY = crop.y + crop.height / 2
  return moveCrop(
    sized,
    image,
    centreX - sized.width / 2 - crop.x,
    centreY - sized.height / 2 - crop.y,
  )
}

/** Where the size slider sits for a frame: its share of the largest that fits. */
export function cropFraction(
  crop: CropRect,
  image: Size,
  aspect: number | null,
): number {
  const maxWidth = maxWidthFor(image, aspectOf(crop, aspect))
  return maxWidth === 0 ? 1 : clamp(crop.width / maxWidth, 0, 1)
}

/**
 * Resize to a width, holding the ratio exactly.
 *
 * The height is derived from the rounded width rather than rounded separately,
 * so a 1:1 frame comes out of every path with `width === height` as integers —
 * the property the stored square depends on.
 */
function withWidth(
  crop: CropRect,
  wanted: number,
  maxWidth: number,
  ratio: number,
): CropRect {
  const minWidth = Math.min(MIN_CROP_PX, maxWidth)
  const width = Math.round(clamp(wanted, minWidth, maxWidth))
  return { ...crop, width, height: Math.round(width / ratio) }
}
