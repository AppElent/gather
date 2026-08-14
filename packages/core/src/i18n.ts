export const SUPPORTED_LOCALES = ['en', 'nl'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export function isLocale<Locales extends readonly string[]>(
  locales: Locales,
  value: unknown,
): value is Locales[number] {
  return typeof value === 'string' && locales.includes(value)
}

export function resolveLocale<Locales extends readonly string[]>(
  locales: Locales,
  fallback: Locales[number],
  savedLocale?: unknown,
  requestedLocales?: string,
): Locales[number] {
  if (isLocale(locales, savedLocale)) return savedLocale
  for (const part of requestedLocales?.split(',') ?? []) {
    const tag = part.split(';')[0]?.trim().toLowerCase()
    if (!tag) continue
    const locale = locales.find(
      (candidate) => tag === candidate || tag.startsWith(`${candidate}-`),
    )
    if (locale) return locale
  }
  return fallback
}

export function fmt(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}

export function plural(
  _locale: string,
  count: number,
  forms: { one: string; other: string },
): string {
  return fmt(count === 1 ? forms.one : forms.other, { count })
}
