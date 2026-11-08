/**
 * A number somebody typed into a box.
 *
 * Dutch writes `6,8` and English `6.8`, and a phone's decimal keypad offers
 * whichever the device's region uses, so both marks read as the decimal point.
 * A blank box is no answer rather than zero: a baby who was not weighed did not
 * weigh 0 kg, and a cost with no amount is not free.
 */
export function parseDecimal(text: string | undefined): number | null {
  const trimmed = text?.trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}
