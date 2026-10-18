// Imported first by `client.tsx`, so it runs before hydration. A no-op without
// VITE_SENTRY_DSN, in dev, and on a local host — local and DSN-less previews
// keep working and never report.
import * as Sentry from '@sentry/react'
import {
  environmentFromHostname,
  isLocalReportingUrl,
  SENTRY_BASE_OPTIONS,
} from './lib/observability/config'
import {
  sanitizeBreadcrumb,
  sanitizeEvent,
  sanitizeText,
} from './lib/observability/privacy'
import { setErrorSink } from './lib/observability/report'

const dsn = import.meta.env.VITE_SENTRY_DSN

if (dsn && !import.meta.env.DEV && !isLocalReportingUrl(window.location.href)) {
  Sentry.init({
    ...SENTRY_BASE_OPTIONS,
    dsn,
    environment: environmentFromHostname(window.location.hostname),
    release: import.meta.env.VITE_SENTRY_RELEASE,
    // Browser extensions throw into the page; they are not ours to fix.
    denyUrls: [/^chrome-extension:/, /^moz-extension:/, /^safari-extension:/],
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSendLog: (log) => ({ ...log, message: sanitizeText(log.message) }),
    // No replay, no tracing: neither is added unless a sample rate asks for it.
  })
  Sentry.setTag('app', 'gather-web')
  setErrorSink((error) => {
    Sentry.captureException(error)
  })
}
