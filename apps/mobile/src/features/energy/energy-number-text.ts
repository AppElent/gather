/**
 * Numbers as an Energy form shows them back for editing: in the reader's
 * decimal mark, without thousands separators, so what is shown parses back
 * to the same value (`parseMeterReading`).
 */

/** How many decimals a figure needs to read back as typed, up to `max`. */
export function decimalsOf(value: number, max = 3): number {
  for (let decimals = 0; decimals < max; decimals++) {
    const factor = 10 ** decimals
    if (Math.abs(Math.round(value * factor) - value * factor) < 1e-6) {
      return decimals
    }
  }
  return max
}

/** `24219,8` in Dutch, `24219.8` in English: never `24.219,8`. */
export function editableNumber(
  value: number,
  locale: string,
  decimals = decimalsOf(value, 5),
): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
