/**
 * How the web's item editor writes an amount. How a grocery list is laid out
 * is `@gather/core/grocery-list`, shared with the phone.
 */
import {
  type GroceryUnit,
  isGroceryQuantity,
  roundGroceryQuantity,
} from '@gather/core/groceries'

/** An item's quantity as an editable decimal, in the reader's notation. */
export function formatAmountDraft(
  quantity: number | undefined,
  locale: string,
): string {
  if (quantity === undefined) return ''
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(quantity)
}

/**
 * A typed amount, with `.` or `,` as its decimal mark: `null` when empty,
 * `undefined` when it is not an amount.
 */
export function parseAmountDraft(text: string): number | null | undefined {
  const typed = text.trim()
  if (!typed) return null
  if (!/^\d+([.,]\d+)?$/.test(typed)) return undefined
  const value = Number(typed.replace(',', '.'))
  return isGroceryQuantity(value) ? roundGroceryQuantity(value) : undefined
}

/** `list` with the item at `from` moved to `to`; a copy either way. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length)
    return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** A unit in a select: singular, except that a count reads "pieces". */
export function unitOptionLabel(
  unit: GroceryUnit,
  words: Record<GroceryUnit, { one: string; other: string }>,
): string {
  return unit === 'stuks' ? words[unit].other : words[unit].one
}
