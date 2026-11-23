/**
 * What the phone sends to Sentry, as plain data. Kept free of React Native
 * imports so a test can run it in Node; `init.ts` is the only caller that
 * touches the SDK. Policy and the list of what is withheld:
 * docs/runbooks/sentry.md.
 */
import { sanitizeBreadcrumb, sanitizeEvent } from '@gather/core/sentry-privacy'
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

import type { Messages } from '../i18n'
import type { Neutrals } from '../theme/palette'

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
 * A route as its file pattern, never as an address:
 * `/(app)/(tabs)/all/tasting/[kind]/subject`, with the dynamic segments left as
 * `[kind]`. Concrete ids and query
 * strings are what `useSegments` already withholds, and what must not be sent.
 */
export function routeName(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}

/**
 * The report form (APP-439): no name or email field, and the one screenshot a
 * member may add is one they take themselves, so nothing is read from the
 * photo library. Shake is started by `shake-to-report.ts` rather than by the
 * SDK, because it pauses while a sheet, alert or picker is presented.
 */
export const FEEDBACK_OPTIONS = {
  enableShakeToReport: false,
  showName: false,
  showEmail: false,
  isNameRequired: false,
  isEmailRequired: false,
  enableScreenshot: false,
  enableTakeScreenshot: true,
  showBranding: false,
} as const

/**
 * The form in Gather's neutrals instead of Sentry's purple. The form belongs to
 * no Module, so its button is `ink`, the accent rule's answer for such a
 * screen (ADR-0017).
 */
export function feedbackTheme(colors: Neutrals) {
  return {
    background: colors.surface,
    foreground: colors.ink,
    accentBackground: colors.ink,
    accentForeground: colors.onInk,
    border: colors.hair,
    feedbackIcon: colors.ink,
    sentryLogo: colors.muted,
  }
}

/** The form's labels in the member's language. */
export function feedbackLabels(text: Messages['feedback']) {
  return {
    formTitle: text.report,
    messageLabel: text.message,
    isRequiredLabel: text.required,
    messagePlaceholder: text.placeholder,
    submitButtonLabel: text.submit,
    cancelButtonLabel: text.cancel,
    addScreenshotButtonLabel: text.add,
    captureScreenshotButtonLabel: text.take,
    removeScreenshotButtonLabel: text.remove,
    errorTitle: text.report,
    formError: text.error,
    genericError: text.error,
    captureScreenshotError: text.error,
    successMessageText: text.success,
  }
}

/** The floating button the form shows while a screenshot is being taken. */
export function screenshotButtonLabels(text: Messages['feedback']) {
  return { triggerLabel: text.take, triggerAriaLabel: text.take }
}
