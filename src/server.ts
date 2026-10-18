// The Worker's fetch entry (`main` in wrangler.jsonc). Wraps TanStack Start's
// handler with Sentry only for deployed requests that have a DSN.
import * as Sentry from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'
import {
  environmentFromHostname,
  isLocalReportingUrl,
  SENTRY_BASE_OPTIONS,
} from './lib/observability/config'
import { sanitizeBreadcrumb, sanitizeEvent } from './lib/observability/privacy'
import { setErrorSink } from './lib/observability/report'

const dsn = import.meta.env.VITE_SENTRY_DSN

// A deployment answers on one hostname family, so this is constant per Worker;
// it is only unknown until the first request, because options are built without one.
let environment: string | undefined

const instrumented = Sentry.withSentry(
  (_env: unknown) => ({
    ...SENTRY_BASE_OPTIONS,
    dsn,
    enabled: !import.meta.env.DEV,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    beforeSend: (event) => {
      if (environment) event.environment = environment
      return sanitizeEvent(event)
    },
    beforeBreadcrumb: sanitizeBreadcrumb,
    // Console output can carry Convex arguments.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== 'Console'),
  }),
  {
    async fetch(request: Request, _env: unknown, _ctx: ExecutionContext) {
      const url = new URL(request.url)
      Sentry.setTag('app', 'gather-web-server')
      environment = environmentFromHostname(url.hostname)
      setErrorSink((error) => {
        Sentry.captureException(error)
      })
      const response = await handler.fetch(request)
      // Start can turn a handled SSR error into a 500 response instead of
      // throwing, so the wrapper never sees the exception.
      if (response.status >= 500) {
        Sentry.captureMessage('TanStack Start returned a server error', {
          level: 'error',
          tags: { status: response.status },
        })
      }
      return response
    },
  } satisfies ExportedHandler,
)

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    // Wrangler hands a local `wrangler dev` its production bindings, so the
    // hostname — not the bindings — decides. Bypass before any span or capture.
    if (!dsn || isLocalReportingUrl(request.url)) return handler.fetch(request)
    return instrumented.fetch(request, env, ctx)
  },
}
