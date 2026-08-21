/**
 * Where a dragged log button lands.
 *
 * Separated from the bar that draws it for the usual reason: a component
 * cannot be asked where it would drop something, and this can. The clamping in
 * particular is worth a test — dragging the first button further left, or the
 * last one further right, must do nothing rather than wrap around to the other
 * end of the bar.
 *
 * Everything is in one dimension and in pixels, because the arranging bar lays
 * its buttons out in a single row of equal width. That is what makes "which
 * slot is the finger over" a division rather than a hit test.
 */

/**
 * The slot a drag of `dx` from `fromIndex` is currently over.
 *
 * Rounded, not truncated: the button snaps to a slot once the finger is past
 * its halfway point, which is where a person expects the swap to happen.
 */
export function dragTarget(
  count: number,
  fromIndex: number,
  dx: number,
  itemWidth: number,
): number {
  // A bar that has not been measured yet cannot place anything.
  if (itemWidth <= 0 || count <= 0) return fromIndex
  const shift = Math.round(dx / itemWidth)
  return Math.min(count - 1, Math.max(0, fromIndex + shift))
}

/** The list with one item lifted out and put back at another index. */
export function movedTo<T>(order: readonly T[], from: number, to: number): T[] {
  const next = [...order]
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= next.length ||
    to >= next.length
  ) {
    return next
  }
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * How far the held button still has to move to sit under the finger, once the
 * other buttons have already slotted around it.
 *
 * Without this the button would jump back to the middle of its new slot on
 * every swap and stop tracking the finger, which reads as the drag being
 * dropped and picked up again.
 */
export function residualOffset(
  dx: number,
  fromIndex: number,
  toIndex: number,
  itemWidth: number,
): number {
  return dx - (toIndex - fromIndex) * itemWidth
}
