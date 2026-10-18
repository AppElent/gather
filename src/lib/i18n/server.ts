import { resolveLocale } from '@gather/core/i18n'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestHeader } from '@tanstack/react-start/server'
import { type Locale, SUPPORTED_LOCALES } from './index'

/**
 * The locale to render the first paint in: the `lang` cookie if the reader has
 * chosen one, otherwise the best match from `Accept-Language`, otherwise
 * English.
 *
 * Written out here rather than built by a factory: TanStack Start's Vite plugin
 * rewrites only the `createServerFn(...).handler(...)` calls it finds in app
 * source into registered endpoints. A server fn built inside a factory in a
 * pre-bundled dependency is never registered, and calling it returns
 * `undefined` instead of running the handler — which is what the old
 * `@appelent/i18n` `createGetSsrLocale` did here, silently, until SSR tried to
 * destructure the result.
 *
 * Returns `{ locale: string }` rather than the `Locale` union because a server
 * function has to declare a concrete return type. `resolveLocale` only ever
 * returns one of `SUPPORTED_LOCALES`, so the call site casts.
 */
export const getSsrLocale = createServerFn({ method: 'GET' }).handler(
  (): { locale: string } => ({
    locale: resolveLocale(
      SUPPORTED_LOCALES,
      'en' satisfies Locale,
      getCookie('lang'),
      getRequestHeader('accept-language'),
    ),
  }),
)
