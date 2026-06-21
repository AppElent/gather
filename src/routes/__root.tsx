import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  AuthConfigProvider,
  ThemeSync,
  THEME_INIT_SCRIPT,
  type AuthConfig,
} from '@appelent/auth'
import ClerkProvider from '../integrations/clerk/provider'
import ConvexProvider from '../integrations/convex/provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

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
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
