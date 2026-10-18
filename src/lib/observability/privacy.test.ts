import type { Breadcrumb, Event } from '@sentry/react'
import { describe, expect, it } from 'vitest'
import {
  sanitizeBreadcrumb,
  sanitizeEvent,
  sanitizeText,
  stripUrl,
} from './privacy'

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlLXZhbHVl'

describe('sanitizeText', () => {
  it('redacts bearer tokens and JWTs', () => {
    expect(sanitizeText(`Authorization: Bearer ${JWT}`)).toBe(
      'Authorization: Bearer [Filtered]',
    )
    expect(sanitizeText(`session ${JWT} expired`)).toBe(
      'session [Filtered] expired',
    )
  })

  it('redacts email addresses', () => {
    expect(sanitizeText('invite sent to Jane.Doe+x@example.nl failed')).toBe(
      'invite sent to [Filtered] failed',
    )
  })

  it('redacts secret-bearing query parameters but keeps the others', () => {
    expect(
      sanitizeText('/cb?code=abc123&state=ok&__clerk_handshake=zzz&token=t'),
    ).toBe(
      '/cb?code=[Filtered]&state=ok&__clerk_handshake=[Filtered]&token=[Filtered]',
    )
  })

  it('redacts the rejected value Convex echoes back in a validation error', () => {
    const message =
      'ArgumentValidationError: Value does not match validator.\nPath: .text\nValue: "baby ran a fever of 39.4"\nValidator: v.string()'
    const out = sanitizeText(message)
    expect(out).not.toContain('fever')
    expect(out).toContain('Path: .text')
    expect(out).toContain('Validator: v.string()')
  })
})

describe('stripUrl', () => {
  it('drops query and fragment', () => {
    expect(stripUrl('https://x.dev/a/b?code=1#frag')).toBe('https://x.dev/a/b')
  })
})

describe('sanitizeBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(
      sanitizeBreadcrumb({ category: 'console', message: 'args {"a":1}' }),
    ).toBeNull()
  })

  it('drops every DOM breadcrumb, whose message carries aria-label text', () => {
    const click: Breadcrumb = {
      category: 'ui.click',
      message:
        'body > main > button[aria-label="Delete task Baby fever 39.4"][title="Dr. Jansen"]',
    }
    expect(sanitizeBreadcrumb(click)).toBeNull()
    expect(sanitizeBreadcrumb({ ...click, category: 'ui.input' })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'ui.scroll' })).toBeNull()
    expect(sanitizeBreadcrumb({ message: 'no category' })).toBeNull()
  })

  it('drops a DOM breadcrumb nested in an event', () => {
    const event = sanitizeEvent({
      breadcrumbs: [
        {
          category: 'ui.click',
          message: 'button[aria-label="Delete task Secret"]',
        },
        { category: 'navigation', data: { from: '/a', to: '/b' } },
      ],
    })
    expect(JSON.stringify(event)).not.toContain('Secret')
    expect(event.breadcrumbs).toHaveLength(1)
  })

  it('keeps structural fields only and strips query strings', () => {
    const crumb: Breadcrumb = {
      category: 'fetch',
      message: 'GET for jane@example.nl',
      data: {
        url: 'https://api.dev/x?email=jane@example.nl',
        method: 'POST',
        status_code: 500,
        body: '{"note":"private"}',
        request_body_size: 42,
      },
    }
    expect(sanitizeBreadcrumb(crumb)).toEqual({
      category: 'fetch',
      message: 'GET for [Filtered]',
      data: { url: 'https://api.dev/x', method: 'POST', status_code: 500 },
    })
  })
})

describe('sanitizeEvent', () => {
  const build = (): Event => ({
    message: `failed for jane@example.nl with ${JWT}`,
    user: { id: 'user_1', email: 'jane@example.nl', ip_address: '1.2.3.4' },
    extra: { args: { title: 'Dentist for the baby' } },
    contexts: { request: { data: 'x' }, os: { name: 'iOS' } },
    transaction: 'GET /recipes/abc?token=secret',
    request: {
      method: 'POST',
      url: 'https://gather.dev/notes?code=123#x',
      query_string: 'code=123',
      cookies: { session: 'abc' },
      headers: { authorization: `Bearer ${JWT}` },
      data: { note: 'private' },
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'bad token=abc for jane@example.nl',
          stacktrace: {
            frames: [{ function: 'f', vars: { password: 'hunter2' } }],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: 'console', message: 'secret args' },
      { category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } },
    ],
  })

  it('keeps no request body, headers, cookies, query string, extra, or locals', () => {
    const event = sanitizeEvent(build())
    expect(event.request).toEqual({
      method: 'POST',
      url: 'https://gather.dev/notes',
    })
    expect(event.extra).toBeUndefined()
    expect(event.contexts).toEqual({ os: { name: 'iOS' } })
    expect(
      event.exception?.values?.[0]?.stacktrace?.frames?.[0],
    ).not.toHaveProperty('vars')
  })

  it('keeps only the opaque user id', () => {
    expect(sanitizeEvent(build()).user).toEqual({ id: 'user_1' })
    expect(
      sanitizeEvent({ user: { email: 'a@b.nl' } } as Event).user,
    ).toBeUndefined()
  })

  it('scrubs text fields and breadcrumbs inside the event', () => {
    const event = sanitizeEvent(build())
    expect(event.message).toBe('failed for [Filtered] with [Filtered]')
    expect(event.transaction).toBe('GET /recipes/abc')
    expect(event.exception?.values?.[0]?.value).toBe(
      'bad token=[Filtered] for [Filtered]',
    )
    expect(event.breadcrumbs).toEqual([
      {
        category: 'navigation',
        message: undefined,
        data: { from: '/a', to: '/b' },
      },
    ])
  })

  it('withholds the message of a Convex server error', () => {
    const event = sanitizeEvent({
      exception: {
        values: [
          {
            type: 'Error',
            value:
              '[CONVEX M(babyEvents:update)] [Request ID: abc123] Server Error\nUncaught ConvexError: {"note":"fever 39.4 at night"}\n  at handler',
          },
        ],
      },
    })
    const value = event.exception?.values?.[0]?.value
    expect(value).toBe(
      '[CONVEX M(babyEvents:update)] [Request ID: abc123] Server Error: ConvexError (message withheld)',
    )
  })

  it('caps the length of an ordinary exception message', () => {
    const event = sanitizeEvent({
      exception: { values: [{ value: 'x'.repeat(2000) }] },
    })
    expect(event.exception?.values?.[0]?.value).toHaveLength(500)
  })

  it('leaves no sensitive string anywhere in the serialised event', () => {
    const json = JSON.stringify(sanitizeEvent(build()))
    for (const secret of [
      'jane@example.nl',
      'hunter2',
      'Dentist',
      'private',
      'eyJhbGci',
      'code=123',
      '1.2.3.4',
    ]) {
      expect(json).not.toContain(secret)
    }
  })
})
