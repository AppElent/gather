/**
 * Scaling an ingredient line for a different number of servings.
 *
 * Ingredients are free text ("2 1/2 cups flour", "1,5 dl melk", "salt"), so
 * only a leading quantity is scaled: a number, a decimal with a point or a
 * comma, a fraction, a mixed number, a unicode fraction, or a range of them.
 * A line without one is left as written.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
}

// Longest forms first: a mixed number before a fraction before a plain number.
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛]|\d+(?:[.,]\d+)?)`
const LEADING = new RegExp(
  String.raw`^(\s*)(${NUMBER})(?:\s*(-|–|tot|to)\s*(${NUMBER}))?`,
)

function parse(text: string): number {
  const trimmed = text.trim()
  const unicode = trimmed.match(/^(\d*)\s*([¼½¾⅓⅔⅛])$/)
  if (unicode)
    return Number(unicode[1] || 0) + (UNICODE_FRACTIONS[unicode[2]] ?? 0)
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  return Number(trimmed.replace(',', '.'))
}

export function scaleIngredient(
  line: string,
  factor: number,
  format: (value: number) => string,
): string {
  if (factor === 1) return line
  const match = line.match(LEADING)
  if (!match) return line
  const [whole, indent, first, separator, second] = match
  const low = parse(first) * factor
  if (!Number.isFinite(low)) return line
  const rest = line.slice(whole.length)
  if (separator && second !== undefined) {
    const high = parse(second) * factor
    return `${indent}${format(low)}${separator === '-' || separator === '–' ? '–' : ` ${separator} `}${format(high)}${rest}`
  }
  return `${indent}${format(low)}${rest}`
}
