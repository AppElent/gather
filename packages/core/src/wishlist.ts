/**
 * A wishlist item's price, as the rows and the detail screen write it.
 *
 * Prices are euros: a Group has no currency of its own yet, and the Finances
 * module draws its home currency the same way (`HOME_CURRENCY`). Formatting is
 * in the app's locale (ADR-0011), so `€ 24,95` in Dutch and `€24.95` in
 * English.
 */
import { formatMoney } from './finance/index'

export const WISHLIST_CURRENCY = 'EUR'

export function formatPrice(cents: number, locale: string): string {
  return formatMoney(cents, WISHLIST_CURRENCY, locale)
}

/** The price as the field shows it while editing: `24,95`, no symbol. */
export function priceText(cents: number | undefined, locale: string): string {
  if (cents === undefined) return ''
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100)
}
