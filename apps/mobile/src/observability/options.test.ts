import { describe, expect, it } from 'vitest'

import { en } from '../i18n/messages/en'
import { nl } from '../i18n/messages/nl'
import { NEUTRALS } from '../theme/palette'
import {
  buildSentryOptions,
  environmentFromChannel,
  FEEDBACK_OPTIONS,
  feedbackLabels,
  feedbackTheme,
  routeName,
  shouldInitSentry,
} from './options'

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlLXZhbHVl'
const options = buildSentryOptions({
  dsn: 'https://key@example.ingest.sentry.io/1',
  environment: 'production',
})

describe('shouldInitSentry', () => {
  it('needs a DSN', () => {
    expect(shouldInitSentry({ dsn: undefined, dev: false, debug: '1' })).toBe(
      false,
    )
    expect(shouldInitSentry({ dsn: '', dev: false, debug: undefined })).toBe(
      false,
    )
  })

  it('stays off in a development bundle unless debug is explicit', () => {
    expect(shouldInitSentry({ dsn: 'x', dev: true, debug: undefined })).toBe(
      false,
    )
    expect(shouldInitSentry({ dsn: 'x', dev: true, debug: '0' })).toBe(false)
    expect(shouldInitSentry({ dsn: 'x', dev: true, debug: '1' })).toBe(true)
  })

  it('is on in a release build with a DSN', () => {
    expect(shouldInitSentry({ dsn: 'x', dev: false, debug: undefined })).toBe(
      true,
    )
  })
})

describe('environmentFromChannel', () => {
  it('follows the update channel', () => {
    expect(environmentFromChannel('preview', false)).toBe('preview')
    expect(environmentFromChannel('production', false)).toBe('production')
    expect(environmentFromChannel('development', true)).toBe('development')
  })

  it('falls back on build mode when there is no channel', () => {
    expect(environmentFromChannel(null, true)).toBe('development')
    expect(environmentFromChannel(undefined, false)).toBe('production')
  })
})

describe('buildSentryOptions', () => {
  it('reports errors only', () => {
    expect(options).toMatchObject({
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      initialScope: { tags: { app: 'gather-mobile' } },
    })
    for (const key of [
      'tracesSampleRate',
      'tracesSampler',
      'profilesSampleRate',
      'replaysSessionSampleRate',
      'replaysOnErrorSampleRate',
      'enableLogs',
      'integrations',
    ]) {
      expect(options).not.toHaveProperty(key)
    }
  })

  it('scrubs an event through the shared scrubber before delivery', () => {
    const event = options.beforeSend({
      type: undefined,
      message: `failed for jane@example.nl with ${JWT}`,
      user: { id: 'user_1', email: 'jane@example.nl', ip_address: '1.2.3.4' },
      extra: { args: { title: 'Dentist for the baby' } },
      exception: {
        values: [
          {
            value: `bad Bearer ${JWT} for jane@example.nl`,
            stacktrace: { frames: [{ vars: { password: 'hunter2' } }] },
          },
        ],
      },
    })
    const json = JSON.stringify(event)
    for (const secret of [
      'jane@example.nl',
      'eyJhbGci',
      'Dentist',
      'hunter2',
    ]) {
      expect(json).not.toContain(secret)
    }
    expect(event.user).toEqual({ id: 'user_1' })
  })

  it('withholds a Convex error message', () => {
    const event = options.beforeSend({
      type: undefined,
      exception: {
        values: [
          {
            value:
              '[CONVEX M(babyEvents:update)] [Request ID: a1] Server Error\nUncaught ConvexError: {"note":"fever 39.4"}',
          },
        ],
      },
    })
    expect(event.exception?.values?.[0]?.value).toBe(
      '[CONVEX M(babyEvents:update)] [Request ID: a1] Server Error: ConvexError (message withheld)',
    )
  })

  it('drops touch, ui and console breadcrumbs', () => {
    for (const category of [
      'touch',
      'ui.click',
      'ui.lifecycle',
      'console',
      'app.lifecycle',
    ]) {
      expect(
        options.beforeBreadcrumb({
          category,
          message: 'Delete task Baby fever 39.4',
        }),
      ).toBeNull()
    }
  })

  it('keeps navigation and http breadcrumbs, path only', () => {
    expect(
      options.beforeBreadcrumb({
        category: 'navigation',
        data: { from: '/(app)/g/[groupId]', to: '/(app)/g/[groupId]/notes' },
      })?.data,
    ).toEqual({ from: '/(app)/g/[groupId]', to: '/(app)/g/[groupId]/notes' })
    expect(
      options.beforeBreadcrumb({
        category: 'xhr',
        data: {
          url: 'https://x.convex.cloud/api/sync?token=abc#f',
          method: 'POST',
          status_code: 200,
          request_body_size: 10,
          body: 'private',
        },
      })?.data,
    ).toEqual({
      url: 'https://x.convex.cloud/api/sync',
      method: 'POST',
      status_code: 200,
    })
  })
})

describe('routeName', () => {
  it('is the file pattern, with dynamic segments left as patterns', () => {
    expect(
      routeName(['(app)', '(tabs)', 'all', 'tasting', '[kind]', 'subject']),
    ).toBe('/(app)/(tabs)/all/tasting/[kind]/subject')
    expect(routeName([])).toBe('/')
  })
})

describe('the report form', () => {
  it('asks for no name or email, and shake is left to shake-to-report', () => {
    expect(FEEDBACK_OPTIONS).toMatchObject({
      showName: false,
      showEmail: false,
      enableShakeToReport: false,
      // A screenshot the member takes, never one read from the library.
      enableScreenshot: false,
      enableTakeScreenshot: true,
    })
  })

  it('speaks the member\'s language', () => {
    expect(feedbackLabels(en.feedback)).toMatchObject({
      formTitle: 'Report a problem',
      submitButtonLabel: 'Send report',
    })
    expect(feedbackLabels(nl.feedback)).toMatchObject({
      formTitle: 'Probleem melden',
      cancelButtonLabel: 'Annuleren',
    })
    for (const text of [en.feedback, nl.feedback]) {
      for (const label of Object.values(feedbackLabels(text))) {
        expect(label.trim()).not.toBe('')
      }
    }
  })

  it('wears Gather\'s neutrals in both schemes, with ink as its button', () => {
    expect(feedbackTheme(NEUTRALS.light)).toMatchObject({
      background: NEUTRALS.light.surface,
      foreground: NEUTRALS.light.ink,
      accentBackground: NEUTRALS.light.ink,
      accentForeground: NEUTRALS.light.onInk,
    })
    expect(feedbackTheme(NEUTRALS.dark).background).toBe(NEUTRALS.dark.surface)
  })
})
