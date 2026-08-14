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
 * so the device decides. A toggle belongs in Settings, behind the door — which
 * is where #164 put it.
 *
 * ## Chosen beats detected, and is remembered
 *
 * `resolveLocale` already takes a saved locale ahead of the requested ones, so
 * persistence is a read at the top and a write at the setter rather than a
 * second decision. What it buys is that detection stops the moment somebody
 * chooses: a Dutch phone that its owner set to English stays English, on this
 * launch and on every one after it, without a round-trip to anything (#159,
 * user story 17 and 21).
 *
 * The read is synchronous for the same reason the Group's is — an awaited one
 * means the first frame is drawn in a language somebody has already rejected.
 */

import {
  type Locale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from '@gather/core/i18n'
import { getLocales } from 'expo-localization'
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react'

import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'
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
 * The locale that was chosen if there is one, the device's language if we speak
 * it, English otherwise. `getLocales()` is ordered by the person's own
 * preference, so the first one we recognise wins over a later one we also
 * speak — and an unreadable or retired stored value simply falls through to
 * that, because `resolveLocale` validates rather than trusts.
 */
function initialLocale(): Locale {
  return resolveLocale(
    SUPPORTED_LOCALES,
    'en',
    readPreference(PREFERENCE_KEYS.locale),
    getLocales()
      .map(({ languageTag }) => languageTag)
      .join(','),
  )
}

interface I18nValue {
  locale: Locale
  t: Messages
  /** Chooses a language and remembers it on this phone. */
  setLocale: (next: Locale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setStored] = useState(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    setStored(next)
    writePreference(PREFERENCE_KEYS.locale, next)
  }, [])

  const value = useMemo(
    () => ({ locale, t: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

/** Throws outside the provider rather than falling back — a silent English leak is worse. */
export function useI18n(): I18nValue {
  const value = use(I18nContext)
  if (!value) throw new Error('useI18n must be used within a LocaleProvider')
  return value
}
