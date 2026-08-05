/**
 * What preparing a photo does, per place the photo will be shown (ADR-0010).
 *
 * A photo is stored as prepared, never as chosen, and *how* it is prepared is a
 * property of where it lands rather than of the screen that uploaded it. A
 * child's photo is a 56px circle at its smallest and is cropped by
 * `object-cover` whatever we do, so the frame is locked square and the person
 * decides which square. A recipe's hero is the largest photo Gather draws — 672
 * CSS px, around 1344 physical px on a phone — so it keeps a free frame and a
 * longest edge with room above what any screen asks for.
 *
 * The table is the whole configuration surface. Call sites name a preset and
 * pass nothing else: no dimensions, no quality, no aspect. That is what stops
 * four upload sites from drifting into four answers, and it is why adding a
 * fifth is a change here rather than a change there.
 *
 * There are two, and a third arrives when a Module genuinely needs one — not
 * before.
 */

export interface PhotoPreset {
  /**
   * Width ÷ height the crop frame is locked to, or `null` for a free frame.
   * A locked frame cannot be dragged out of its aspect; a free one opens
   * enclosing the whole image, so confirming it unchanged crops nothing.
   */
  readonly aspect: number | null
  /** Longest edge of the stored image, in pixels. Never upscales past it. */
  readonly maxEdge: number
  /** JPEG quality, 0–1. */
  readonly quality: number
}

export const PHOTO_PRESETS = {
  childPhoto: { aspect: 1, maxEdge: 512, quality: 0.82 },
  recipePhoto: { aspect: null, maxEdge: 1600, quality: 0.82 },
} as const satisfies Record<string, PhotoPreset>

export type PhotoPresetName = keyof typeof PHOTO_PRESETS

export function photoPreset(name: PhotoPresetName): PhotoPreset {
  return PHOTO_PRESETS[name]
}
