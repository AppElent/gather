/**
 * Where a bottom sheet is allowed to come to rest, as a fraction of its own
 * height translated downwards: 0 is fully up, 1 is entirely off-screen.
 *
 * The numbers, the thresholds below and the rubber band all come from driving
 * the prototype on a real phone (branch `prototype/nutrition-add-sheet`, which
 * is a primary source and not code to merge). They are the part of that
 * exercise worth keeping.
 */
export const DETENTS = { full: 0, peek: 0.42, closed: 1 } as const

export type Detent = keyof typeof DETENTS

/**
 * How far a finger must travel before it is a drag rather than a tap.
 *
 * Six pixels: a tap on a row that moves a little must still open the row, and
 * a deliberate drag that starts on a row must still move the sheet.
 */
export const DRAG_THRESHOLD_PX = 6

/**
 * The speed, in pixels per millisecond, at which a flick beats position.
 *
 * A quick flick down from full goes to peek rather than all the way out, so
 * one gesture never both collapses and closes; a flick up always goes full.
 */
export const FLICK_VELOCITY = 0.55

/** The detent a resting position is closest to. */
export function nearestDetent(frac: number): Detent {
  const names = Object.keys(DETENTS) as Detent[]
  return names.reduce((best, name) =>
    Math.abs(DETENTS[name] - frac) < Math.abs(DETENTS[best] - frac)
      ? name
      : best,
  )
}

/**
 * Where the sheet lands when the finger lifts.
 *
 * Velocity first — a flick is a statement about intent that position cannot
 * contradict — and the nearest detent otherwise.
 */
export function releaseDetent(
  frac: number,
  velocity: number,
  from: Detent,
): Detent {
  if (velocity > FLICK_VELOCITY) return from === 'full' ? 'peek' : 'closed'
  if (velocity < -FLICK_VELOCITY) return 'full'
  return nearestDetent(frac)
}

/**
 * Dragging past full does not stop dead: it gives a quarter of what the finger
 * asks for, up to a hair above the top, and springs back on release. Dragging
 * below closed is simply refused — there is nothing further down to see.
 */
export function rubberBand(frac: number): number {
  if (frac < 0) return Math.max(-0.04, frac * 0.25)
  return Math.min(1, frac)
}
