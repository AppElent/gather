/**
 * Where a dragged row lands, in one dimension and in pixels.
 *
 * The vertical twin of `modules/baby/logBarArrange.ts`, which does the same job
 * for a horizontal bar. They are not shared yet: two call sites is not a
 * pattern, and the day the Tasks Module ships is the day to decide whether one
 * `arrange.ts` serves both.
 *
 * The clamping is the part worth a test â€” dragging the first row further up,
 * or the last one further down, must do nothing rather than wrap around to the
 * other end of the list.
 */

/**
 * The index a drag of `dy` from `fromIndex` is currently over.
 *
 * Rounded rather than truncated: the row snaps once the finger is past the
 * halfway point of the next one, which is where a person expects the swap.
 */
export function dropIndex(
  count: number,
  fromIndex: number,
  dy: number,
  rowHeight: number,
): number {
  if (rowHeight <= 0 || count <= 0) return fromIndex
  const shift = Math.round(dy / rowHeight)
  return Math.min(count - 1, Math.max(0, fromIndex + shift))
}

/** The list with one item lifted out and put back at another index. */
export function movedTo<T>(order: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= order.length ||
    to >= order.length
  ) {
    return [...order]
  }
  const next = [...order]
  const [lifted] = next.splice(from, 1)
  next.splice(to, 0, lifted)
  return next
}

/**
 * How far a row that is not the dragged one has been pushed aside.
 *
 * Every row between the origin and the target shuffles by exactly one row
 * height, in the direction that opens the gap. Returning a number rather than
 * a style keeps the animation in the component and the arithmetic here.
 */
export function shiftFor(
  index: number,
  fromIndex: number,
  toIndex: number,
  rowHeight: number,
): number {
  if (index === fromIndex) return 0
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
    return -rowHeight
  }
  if (fromIndex > toIndex && index < fromIndex && index >= toIndex) {
    return rowHeight
  }
  return 0
}
