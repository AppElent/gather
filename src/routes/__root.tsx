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
    afterAuth: '/dashboard',
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
      { name: 'theme-color', content: '#000000' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

export function NotFoundPage() {
  return (
    <PublicPageFrame
      eyebrow="Not found"
      title="Page not found"
      subtitle="This route is not part of the current Gather workspace."
      actions={
        <Link to="/sign-in" className="text-[var(--app-muted)] no-underline">
          Sign in
        </Link>
      }
    >
      <div className="grid gap-4">
        <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
          The page may have moved, or the link may point to a module that has
          not been added yet.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] no-underline"
        >
          Go to dashboard
        </Link>
      </div>
    </PublicPageFrame>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // non-fatal: app still works without offline/installable support
    })
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme no-flash script must run before hydration; content is a static constant from @appelent/auth */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere]">
        <ClerkProvider>
          <ConvexProvider>
            <AuthConfigProvider config={authConfig}>
              <ThemeSync />
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
        <Scripts />
      </body>
    </html>
  )
}
