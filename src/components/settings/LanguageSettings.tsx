import { type Locale, SUPPORTED_LOCALES, useI18n } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'

/**
 * The same choice the topbar toggle makes, on the page somebody looks at when
 * they are looking for a setting rather than for a button.
 *
 * Not a duplicate state to keep in step — both read and write the one
 * `useI18n()` value — but a duplicate *entrance*, which is the point: the
 * toggle is for flipping, this is for finding.
 *
 * Each language is written in itself. "Dutch" is only helpful to somebody who
 * already reads English, which is exactly the reader this row is not for.
 */
export function LanguageSettings() {
  const { locale, messages, setLocale } = useI18n()
  const { language } = messages.settings

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">{language.title}</h2>
      <p className="m-0 mb-3 text-sm text-[var(--app-muted)]">
        {language.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LOCALES.map((option: Locale) => {
          const isOn = option === locale
          return (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={isOn}
              onClick={() => setLocale(option)}
              className={`inline-flex min-h-9 items-center justify-center rounded-[var(--app-radius)] border px-3 text-sm font-semibold ${
                isOn
                  ? 'border-[var(--app-fg)] bg-[var(--app-fg)] text-[var(--app-surface)]'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)]'
              }`}
            >
              {language.names[option]}
            </button>
          )
        })}
      </div>
    </SurfaceCard>
  )
}
