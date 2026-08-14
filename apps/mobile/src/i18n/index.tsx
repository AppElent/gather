/**
 * The phone's own i18n engine.
 *
 * `@appelent/i18n` is not a dependency here and will not become one (#140):
 * it reaches for `Intl.PluralRules` and `Intl.RelativeTimeFormat`, and Hermes
 * ships neither. What the web's provider actually does — hold a locale, hand
 * down a typed dictionary, substitute `{placeholder}` tokens — is the forty
 * lines below.
 *
 * There is no language toggle on the front door, deliberately: the web's
 * signed-out pages have none either, and a person who has not signed in yet has
 * nowhere to have stated a preference. The device is the only thing that knows,
 * so the device decides. A toggle belongs in Settings, behind the door.
 */

import {
  type Locale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from '@gather/core/i18n'
import { getLocales } from 'expo-localization'
import { createContext, type ReactNode, use, useMemo } from 'react'

import { en } from './messages/en'
import { nl } from './messages/nl'

export type { Locale } from '@gather/core/i18n'
export {
  fmt,
  isLocale,
  plural,
  resolveLocale,
  SUPPORTED_LOCALES,
} from '@gather/core/i18n'
export type Messages = typeof en

const DICTIONARIES: Record<Locale, Messages> = { en, nl }

/**
 * The device's language if we speak it, English otherwise. `getLocales()` is
 * ordered by the person's own preference, so the first one we recognise wins
 * over a later one we also speak.
 */
function detectLocale(): Locale {
  return resolveLocale(
    SUPPORTED_LOCALES,
    'en',
    undefined,
    getLocales()
      .map(({ languageTag }) => languageTag)
      .join(','),
  )
}

interface I18nValue {
  locale: Locale
  t: Messages
}

const I18nContext = createContext<I18nValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const locale = detectLocale()
    return { locale, t: DICTIONARIES[locale] }
  }, [])

  return <I18nContext value={value}>{children}</I18nContext>
}

/** Throws outside the provider rather than falling back — a silent English leak is worse. */
export function useI18n(): I18nValue {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used within a LocaleProvider')
  return value
}
