/**
 * Turning the seam's figures into the words on the screen.
 *
 * Everything here formats in the **app's** locale rather than the device's
 * (ADR-0011), and everything that draws money goes through `money()` so a
 * screen cannot invent its own idea of what a euro looks like.
 *
 * The one thing that is not a formatter: `monthsFromToday` and `dateForMonth`
 * translate between the seam's month offsets and the dates a Member typed. The
 * seam counts months from now on purpose — a stored count would mean something
 * different every month it was not opened — so the translation has to happen
 * somewhere, and it happens once, here.
 */

import { formatMoney, monthsUntil, todayIso } from '@gather/core/finance'

export interface Formatters {
  money: (cents: number, options?: { decimals?: boolean }) => string
  /** `1 July 2026`, for a date somebody chose. */
  date: (iso: string) => string
  /** `June 2031`, for a month a calculation lands on. */
  month: (iso: string) => string
  /** `17:35 today`, for the moment a price is as at. */
  time: (epochMs: number) => string
  percent: (value: number, digits?: number) => string
  /** A signed figure, so a fall reads as one. */
  signedMoney: (cents: number) => string
}

export function formatters(locale: string, currency: string): Formatters {
  const money = (cents: number, options: { decimals?: boolean } = {}) =>
    formatMoney(cents, currency, locale, options)

  return {
    money,
    date: (iso) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    month: (iso) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      }),
    time: (epochMs) => {
      const when = new Date(epochMs)
      const sameDay = new Date().toDateString() === when.toDateString()
      const clock = when.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
      return sameDay
        ? clock
        : `${when.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${clock}`
    },
    percent: (value, digits = 2) =>
      `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value)} %`,
    signedMoney: (cents) => (cents > 0 ? `+ ${money(cents)}` : money(cents)),
  }
}

/** Months from today to a date a Member entered. Zero for a date behind us. */
export function monthsFromToday(iso: string | undefined, now = todayIso()) {
  return iso ? monthsUntil(now, iso) : undefined
}

/** The `YYYY-MM-DD` a month offset from the seam lands on. */
export function dateForMonth(month: number, now = todayIso()): string {
  const [year, monthPart, day] = now.split('-').map(Number)
  const shifted = year * 12 + (monthPart - 1) + Math.max(0, month - 1)
  const nextYear = Math.floor(shifted / 12)
  const nextMonth = (shifted % 12) + 1
  const last = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate()
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-${String(
    Math.min(day, last),
  ).padStart(2, '0')}`
}
