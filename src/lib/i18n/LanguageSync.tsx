import { createLanguageSync } from '@appelent/i18n/clerk-sync'
import { hasExplicitLocaleChoice, SUPPORTED_LOCALES, useI18n } from './index'

/**
 * Mirrors an explicit language choice onto the signed-in user, so it follows
 * them to another device. The cookie stays the source of truth on this one —
 * this is a best-effort copy, not a second answer to the same question.
 */
export const LanguageSync = createLanguageSync({
  useI18n,
  hasExplicitLocaleChoice,
  locales: SUPPORTED_LOCALES,
})
