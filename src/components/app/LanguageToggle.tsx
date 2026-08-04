import { fmt, type Locale, useI18n } from '../../lib/i18n'
import { IconButton } from './ShellPrimitives'

/**
 * Flip the language, from the topbar.
 *
 * Two locales, so this is a switch rather than a menu: the button shows the
 * language you are in and says, when asked, the one it would take you to. A
 * third locale turns this into a list, and that is the moment to write one —
 * not before.
 *
 * `IconButton` rather than a bespoke button: it already sets `aria-label` and
 * `title` from a single label, which is exactly what a two-character control
 * needs, and it keeps this the same size and shape as the three controls it
 * sits beside.
 */
const NEXT_LOCALE: Record<Locale, Locale> = { en: 'nl', nl: 'en' }

export function LanguageToggle() {
  const { locale, messages, setLocale } = useI18n()
  const next = NEXT_LOCALE[locale]
  const label = fmt(messages.shell.topbar.switchLanguage, {
    language: messages.settings.language.names[next],
  })

  return (
    <IconButton
      label={label}
      onClick={() => setLocale(next)}
      className="text-xs font-semibold"
    >
      {locale.toUpperCase()}
    </IconButton>
  )
}
