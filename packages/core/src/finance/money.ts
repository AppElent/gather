/**
 * Money in this Module is an integer number of cents, and it never stops being
 * one until the moment it is drawn.
 *
 * Every figure in Finances is one a Member typed (ADR-0025), and the arithmetic
 * on it is the product. Holding it as a float would mean `0.1 + 0.2` deciding
 * whether a split of three settles to zero — so the seam takes cents, returns
 * cents, and rounds exactly once, here.
 */

/** An amount of money, as a whole number of cents. */
export type Cents = number

/** Half-up on the magnitude, so −0.5 rounds to −1 rather than to 0. */
export function roundCents(value: number): Cents {
  return Math.sign(value) * Math.round(Math.abs(value))
}

/** Cents from a decimal amount a Member typed. */
export function toCents(amount: number): Cents {
  return roundCents(amount * 100)
}

/** The decimal amount a formatter wants. */
export function fromCents(cents: Cents): number {
  return cents / 100
}

/**
 * Split `total` into `count` parts that add back up to `total`.
 *
 * The remainder goes one cent at a time to the parts at the front rather than
 * being dropped: three people sharing €10.00 owe 3.34, 3.33 and 3.33, and the
 * calculation that says otherwise is the one people notice.
 */
export function splitEvenly(total: Cents, count: number): Cents[] {
  if (count <= 0) return []
  const base = Math.trunc(total / count)
  let remainder = total - base * count
  const step = remainder >= 0 ? 1 : -1
  return Array.from({ length: count }, () => {
    if (remainder === 0) return base
    remainder -= step
    return base + step
  })
}

/**
 * Format an amount in the reader's language.
 *
 * The app's own locale, never the device's: a figure formatted in one language
 * beside a label written in the other reads as a bug (ADR-0011).
 */
export function formatMoney(
  cents: Cents,
  currency: string,
  locale: string,
  options: { decimals?: boolean } = {},
): string {
  const decimals = options.decimals ?? true
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(fromCents(cents))
}

/** A rate as a Member wrote it — `3.9` — as a monthly fraction. */
export function monthlyRate(annualPercent: number): number {
  return annualPercent / 100 / 12
}
