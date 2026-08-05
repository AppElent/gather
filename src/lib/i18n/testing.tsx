import { type RenderOptions, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { type Locale, LocaleProvider } from './index'

/**
 * Render a component that reads messages.
 *
 * `useI18n` throws outside `LocaleProvider` rather than falling back to a
 * default locale, which is the right call — a component quietly rendering the
 * fallback language because a provider went missing is a bug that ships. The
 * cost is that every test rendering a chrome component needs a wrapper, so
 * there is one wrapper rather than one per suite.
 *
 * Defaults to English so existing assertions keep asserting the strings they
 * always did; pass `locale` to check a translation actually reaches the screen.
 */
export function renderWithI18n(
  ui: ReactElement,
  { locale = 'en', ...options }: RenderOptions & { locale?: Locale } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
    ),
    ...options,
  })
}
