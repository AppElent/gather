/**
 * Starts Sentry. Imported first by `app/_layout.tsx` so a crash during the
 * rest of module evaluation is still reported. A no-op without
 * `EXPO_PUBLIC_SENTRY_DSN`, and in a development bundle unless
 * `EXPO_PUBLIC_SENTRY_DEBUG=1`. Also owns the report form (APP-439).
 *
 * Static dot access on `process.env` is load-bearing: Metro substitutes
 * `EXPO_PUBLIC_*` textually at bundle time (see `auth/config.ts`).
 */
import type { Locale } from '@gather/core/i18n'
import { sanitizeFeedbackEvent } from '@gather/core/sentry-privacy'
import * as Sentry from '@sentry/react-native'
import * as Updates from 'expo-updates'

// The message files and the palette, not the i18n or theme index: those load
// the stored preferences, which must not run before Sentry starts.
import { en } from '../i18n/messages/en'
import { nl } from '../i18n/messages/nl'
import { NEUTRALS } from '../theme/palette'
import {
  buildSentryOptions,
  environmentFromChannel,
  FEEDBACK_OPTIONS,
  feedbackLabels,
  feedbackTheme,
  screenshotButtonLabels,
  shouldInitSentry,
} from './options'
import { startShakeToReport } from './shake-to-report'

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

/**
 * Whether this bundle reports to Sentry: the one check for `Sentry.wrap`, for
 * shake-to-report and for offering the report form.
 */
export const sentryEnabled = Boolean(
  dsn &&
    shouldInitSentry({
      dsn,
      dev: __DEV__,
      debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG,
    }),
)

const feedback = Sentry.feedbackIntegration({
  ...FEEDBACK_OPTIONS,
  ...feedbackLabels(en.feedback),
  screenshotButtonOptions: screenshotButtonLabels(en.feedback),
  themeLight: feedbackTheme(NEUTRALS.light),
  themeDark: feedbackTheme(NEUTRALS.dark),
})

/** Keeps the report form in the language the app is showing. */
export function setFeedbackLocale(locale: Locale) {
  const text = { en, nl }[locale].feedback
  Object.assign(feedback.options, feedbackLabels(text))
  Object.assign(feedback.screenshotButtonOptions, screenshotButtonLabels(text))
}

/**
 * Opens the report form. `false` when this bundle does not report (a
 * development bundle, or a build without a DSN), so the caller says so in the
 * member's language instead.
 */
export function openProblemReport(): boolean {
  if (!sentryEnabled) return false
  Sentry.showFeedbackForm()
  return true
}

if (dsn && sentryEnabled) {
  Sentry.init({
    ...buildSentryOptions({
      dsn,
      environment: environmentFromChannel(Updates.channel, __DEV__),
    }),
    integrations: [feedback],
  })
  // Feedback skips beforeSend; this gives a report the same scrubbing.
  Sentry.addEventProcessor(sanitizeFeedbackEvent)
  startShakeToReport()
}
