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
 * It lives in `@gather/core` rather than in the web app because the phone
 * prepares photos too, and two clients answering "how big is a memory photo"
 * separately is the drift this table exists to prevent (ADR-0016).
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
  /**
   * The photo on a Memory in the Baby log — the third preset ADR-0010 said
   * would arrive when a Module genuinely needed one.
   *
   * Free-framed, and unlike the other two it is not cropped at all before
   * upload. The framing step exists because a stored photo is the only copy
   * and a child's avatar is a circle somebody had better choose the middle
   * of. A memory is the opposite case: the whole picture is the point, it was
   * framed by whoever took it, and `expo-image-picker`'s editor forces a
   * square on iOS — so offering "framing" there would silently make every
   * memory square. It is resized and re-encoded, and nothing else.
   */
  memoryPhoto: { aspect: null, maxEdge: 1600, quality: 0.82 },
  /**
   * The picture on a person's own account.
   *
   * It is never drawn larger than a 46px circle and it is stored by Clerk
   * rather than in Convex, but the numbers belong here for the reason the
   * other three do: a call site that picked its own would be a second answer
   * to "how big is a photo in Gather", and this table exists so there is only
   * ever one.
   *
   * Square, because every place it appears is a circle — the phone's Settings
   * card, and the member list a Group draws.
   */
  profilePhoto: { aspect: 1, maxEdge: 512, quality: 0.82 },
} as const satisfies Record<string, PhotoPreset>

export type PhotoPresetName = keyof typeof PHOTO_PRESETS

export function photoPreset(name: PhotoPresetName): PhotoPreset {
  return PHOTO_PRESETS[name]
}
