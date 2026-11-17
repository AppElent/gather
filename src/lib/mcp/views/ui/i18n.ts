import { fmt, type Locale, resolveLocale, SUPPORTED_LOCALES } from '@gather/core/i18n'
import { en, nl } from '@gather/core/messages'

export type ViewMessages = (typeof en)['mcpViews']

const CATALOG: Record<Locale, ViewMessages> = {
  en: en.mcpViews,
  nl: nl.mcpViews,
}

type DayStyle = 'weekday' | 'dayMonth' | 'long'

const DAY_STYLES: Record<DayStyle, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  dayMonth: { day: 'numeric', month: 'short' },
  long: { weekday: 'long', day: 'numeric', month: 'long' },
}

export type ViewText = ReturnType<typeof viewText>

/** Copy and formatting in the host's language; English when unsupported. */
export function viewText(hostLocale: string | undefined) {
  const locale = resolveLocale(SUPPORTED_LOCALES, 'en', undefined, hostLocale)
  return {
    locale,
    t: CATALOG[locale],
    fmt,
    plural: (count: number, forms: { one: string; other: string }) =>
      fmt(count === 1 ? forms.one : forms.other, { count }),
    number: (value: number, digits = 2) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(
        value,
      ),
    /** A calendar day (YYYY-MM-DD) in the given style. */
    day: (date: string, style: DayStyle) =>
      new Intl.DateTimeFormat(locale, {
        ...DAY_STYLES[style],
        timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`)),
  }
}
