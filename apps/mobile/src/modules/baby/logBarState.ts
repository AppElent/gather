/** Hiding never reorders what remains visible. */
export function hideSlot<T>(slots: readonly T[], slot: T): T[] {
  return slots.filter((item) => item !== slot)
}

/**
 * Restores missing event types, then shortcuts, after the current arrangement.
 * That keeps a person's explicit order intact while making Show all predictable.
 */
export function showAllSlots<T>(
  slots: readonly T[],
  eventTypes: readonly T[],
  shortcuts: readonly T[],
): T[] {
  const next = [...slots]
  for (const item of [...eventTypes, ...shortcuts]) {
    if (!next.includes(item)) next.push(item)
  }
  return next
}

/**
 * The key of a log bar item's context menu. The item is only as wide as its
 * label, and the menu cannot see a new label in a slot that sizes itself, so
 * the key follows the label: a language switch remounts the menu at the new
 * width (APP-764).
 */
export function slotMenuKey(slot: string, label: string): string {
  return `${slot}:${label}`
}
