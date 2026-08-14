import { createI18n } from '@appelent/i18n'
import { fmt, type Locale, plural, SUPPORTED_LOCALES } from '@gather/core/i18n'
import { en, type Messages, nl } from '@gather/core/messages'

/**
 * Joins Gather's portable locale contract to the web i18n engine.
 *
 * The provider and hooks live in `@appelent/i18n`; Gather's messages and pure
 * locale helpers live in `@gather/core`. See ADR-0011 for the chrome/content
 * boundary.
 */
export { fmt, plural, SUPPORTED_LOCALES }
export type { Locale, Messages }

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
