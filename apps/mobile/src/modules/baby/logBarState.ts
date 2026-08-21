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
