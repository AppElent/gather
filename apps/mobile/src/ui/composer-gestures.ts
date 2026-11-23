/**
 * What a drag on the keyboard composer does (APP-587, APP-661): the numbers
 * and the decision, kept apart from the gesture so they can be tested.
 *
 * Up expands the small card; down collapses an expanded one, and further down
 * closes it. A small card closes on a shorter drag down. Closing keeps the
 * draft: that is the kind's (`composer-drafts.ts`).
 */

/** How far up a drag must travel to expand the card, in points. */
export const DRAG_EXPAND = 32
/** How far down a drag must travel to collapse an expanded card, or close a small one. */
export const DRAG_CLOSE = 72
/** How far down an expanded card must be dragged to close rather than collapse. */
export const DRAG_CLOSE_EXPANDED = 280
/** A flick this fast counts however short it was, in points per second. */
const FLICK_UP = -600
const FLICK_DOWN = 900
/** How much of an upward drag the small card follows: it resists, then grows. */
const UP_RESISTANCE = 0.35

export type DragOutcome = 'expand' | 'collapse' | 'close' | null

export interface DragEnd {
  translationY: number
  velocityY: number
}

/** What the card does when the finger lifts. */
export function dragOutcome(
  { translationY, velocityY }: DragEnd,
  expanded: boolean,
): DragOutcome {
  const up = translationY < -DRAG_EXPAND || velocityY < FLICK_UP
  const down = translationY > DRAG_CLOSE || velocityY > FLICK_DOWN
  if (expanded) {
    if (translationY > DRAG_CLOSE_EXPANDED) return 'close'
    return down && !up ? 'collapse' : null
  }
  if (up && !down) return 'expand'
  if (down) return 'close'
  return null
}

/**
 * Where the card sits under the finger while it drags: down one to one, up a
 * little for a small card (so the drag visibly answers), and not at all for
 * an expanded one, which already reaches the status bar.
 */
export function dragOffset(translationY: number, expanded: boolean): number {
  if (translationY >= 0) return translationY
  return expanded ? 0 : translationY * UP_RESISTANCE
}
