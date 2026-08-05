import { createI18n } from '@appelent/i18n'
import { en, type Messages } from './messages/en'
import { nl } from './messages/nl'

/**
 * Gather's i18n engine, built once from its own locale set and message tree.
 *
 * The engine itself — locale resolution, `fmt`/`plural`, the provider and hooks
 * — lives in `@appelent/i18n` and is shared across Appelent apps. What is
 * gather's own is this file's three lines of configuration and everything under
 * `messages/`. See ADR-0011 for which strings belong there and which do not.
 */
export const SUPPORTED_LOCALES = ['en', 'nl'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type { Messages }

export const {
  LocaleProvider,
  useI18n,
  useMessages,
  readClientLocale,
  hasExplicitLocaleChoice,
} = createI18n<Locale, Messages>({
  locales: SUPPORTED_LOCALES,
  fallback: 'en',
  messages: { en, nl },
})

export { fmt, plural } from '@appelent/i18n'
