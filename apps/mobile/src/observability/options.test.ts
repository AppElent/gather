import { describe, expect, it } from 'vitest'

import {
  buildSentryOptions,
  environmentFromChannel,
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
    expect(routeName(['(app)', 'g', '[groupId]', 'recipes'])).toBe(
      '/(app)/g/[groupId]/recipes',
    )
    expect(routeName([])).toBe('/')
  })
})
