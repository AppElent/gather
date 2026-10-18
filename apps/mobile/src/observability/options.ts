/**
 * What the phone sends to Sentry, as plain data. Kept free of React Native
 * imports so a test can run it in Node; `init.ts` is the only caller that
 * touches the SDK. Policy and the list of what is withheld:
 * docs/runbooks/sentry.md.
 */
import { sanitizeBreadcrumb, sanitizeEvent } from '@gather/core/sentry-privacy'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

export type SentryEnvironment = 'development' | 'preview' | 'production'

/**
 * A DSN is required, and a development bundle stays silent unless somebody
 * asks for it: Metro serves `__DEV__` builds from a laptop, and their errors
 * are not the household's. `EXPO_PUBLIC_SENTRY_DEBUG=1` is the explicit
 * override, for looking at a payload against a throwaway listener.
 */
export function shouldInitSentry(config: {
  dsn: string | undefined
  dev: boolean
  debug: string | undefined
}): boolean {
  if (!config.dsn) return false
  return !config.dev || config.debug === '1'
}

/** The channel a build was made for, which is the deployment it belongs to. */
export function environmentFromChannel(
  channel: string | null | undefined,
  dev: boolean,
): SentryEnvironment {
  if (channel === 'preview' || channel === 'development') return channel
  return dev ? 'development' : 'production'
}

/**
 * Errors only. Tracing, profiling, replay, logs and screenshots are all off
 * because their option is absent or false, not because a sample rate is zero.
 * This is a household app holding health, money and notes; nothing here needs
 * them. Sessions are off too, so a user never counts as a visitor.
 */
export function buildSentryOptions(config: {
  dsn: string
  environment: SentryEnvironment
}) {
  return {
    dsn: config.dsn,
    environment: config.environment,
    sendDefaultPii: false,
    attachStacktrace: true,
    maxBreadcrumbs: 30,
    enableAutoSessionTracking: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    enableStallTracking: false,
    enableAutoPerformanceTracing: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Keep native breadcrumbs from being copied across; the JS scrubber is the
    // only place the allowlist is enforced.
    enableNdkScopeSync: false,
    initialScope: { tags: { app: 'gather-mobile' } },
    beforeSend: (event: ErrorEvent) => sanitizeEvent(event),
    beforeBreadcrumb: (breadcrumb: Breadcrumb) =>
      sanitizeBreadcrumb(breadcrumb),
  }
}

/**
 * A route as its file pattern, never as an address: `/(app)/g/[groupId]/recipes`,
 * with the dynamic segments left as `[groupId]`. Concrete ids and query
 * strings are what `useSegments` already withholds, and what must not be sent.
 */
export function routeName(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}
