import { Check } from 'lucide-react'
import { type Locale, SUPPORTED_LOCALES, useI18n } from '../../lib/i18n'
import { InsetList, InsetRow, SectionFooter, SectionLabel } from '../app/InsetList'

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
    <section aria-labelledby="language-heading">
      <SectionLabel id="language-heading">{language.title}</SectionLabel>
      <InsetList>
        {SUPPORTED_LOCALES.map((option: Locale) => {
          const isOn = option === locale
          return (
            <InsetRow
              key={option}
              title={<span lang={option}>{language.names[option]}</span>}
              onClick={() => setLocale(option)}
              selected={isOn}
              trailing={
                isOn ? (
                  <Check
                    className="size-[18px] text-[var(--ink)]"
                    strokeWidth={2.6}
                    aria-hidden="true"
                  />
                ) : undefined
              }
            />
          )
        })}
      </InsetList>
      <SectionFooter>{language.description}</SectionFooter>
    </section>
  )
}
