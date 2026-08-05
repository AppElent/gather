import {
  type AuthConfig,
  AuthConfigProvider,
  THEME_INIT_SCRIPT,
  ThemeSync,
} from '@appelent/auth'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import ClerkProvider from '../integrations/clerk/provider'
import ConvexProvider from '../integrations/convex/provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import {
  type Locale,
  LocaleProvider,
  readClientLocale,
  useMessages,
} from '../lib/i18n'
import { LanguageSync } from '../lib/i18n/LanguageSync'
import { getSsrLocale } from '../lib/i18n/server'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

const authConfig: AuthConfig = {
  appName: 'gather',
  paths: {
    signIn: '/sign-in',
    signUp: '/sign-up',
    forgotPassword: '/forgot-password',
    afterAuth: '/',
    account: '/account',
  },
  features: { forgotPassword: true },
  socialProviders: [],
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'gather' },
      // `theme-color` is deliberately absent here — it needs one entry per
      // colour scheme, and the router's head manager dedupes `meta` by `name`,
      // so a second entry silently replaces the first. Both live in
      // `RootDocument`'s `<head>` instead.
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      // .ico first as the universal fallback, .svg after it so browsers that
      // understand vector favicons pick the crisp one.
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  /**
   * Which language to draw the first paint in.
   *
   * Two branches rather than one server call: after hydration the cookie is
   * already on this machine, so asking the server again would be a round-trip
   * to learn something the browser can read synchronously — and a flash of the
   * wrong language while it is in flight.
   */
  loader: async () => {
    if (typeof document !== 'undefined') {
      return { locale: readClientLocale() }
    }
    const { locale } = (await getSsrLocale()) as { locale: Locale }
    return { locale }
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

export function NotFoundPage() {
  const { notFound } = useMessages().shell

  return (
    <PublicPageFrame
      eyebrow={notFound.eyebrow}
      title={notFound.title}
      subtitle={notFound.subtitle}
      actions={
        <Link to="/sign-in" className="text-[var(--app-muted)] no-underline">
          {notFound.signIn}
        </Link>
      }
    >
      <div className="grid gap-4">
        <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
          {notFound.body}
        </p>
        <Link
          to="/"
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] no-underline"
        >
          {notFound.goHome}
        </Link>
      </div>
    </PublicPageFrame>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale } = Route.useLoaderData()

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // non-fatal: app still works without offline/installable support
    })
  }, [])

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Written here rather than in the route's `head.meta`: two entries
            share the name `theme-color` and the head manager keeps only the
            last one. The values are `--bg-base` from each scheme in
            styles.css, so the browser chrome matches the page behind it. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#e7f3ec"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0a1418"
        />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme no-flash script must run before hydration; content is a static constant from @appelent/auth */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        {/* Outermost, because every provider below it and every page inside
            them may need a word from it. `LanguageSync` sits further in: it
            mirrors the choice onto the signed-in user, so it needs Clerk. */}
        <LocaleProvider initialLocale={locale}>
          <ClerkProvider>
            <ConvexProvider>
              <AuthConfigProvider config={authConfig}>
                <ThemeSync />
                <LanguageSync />
                {children}
                <TanStackDevtools
                  config={{ position: 'bottom-right' }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                    TanStackQueryDevtools,
                  ]}
                />
              </AuthConfigProvider>
            </ConvexProvider>
          </ClerkProvider>
        </LocaleProvider>
        <Scripts />
      </body>
    </html>
  )
}
