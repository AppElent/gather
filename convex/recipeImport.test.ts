import { describe, expect, test, vi } from 'vitest'
import { isUrlSafeToFetch, safeFetch } from './recipeImport'

describe('isUrlSafeToFetch', () => {
  test('allows a normal public https URL', () => {
    expect(isUrlSafeToFetch('https://example.com/recipe')).toBe(true)
  })

  test('blocks IPv4 loopback', () => {
    expect(isUrlSafeToFetch('http://127.0.0.1/x')).toBe(false)
  })

  test('blocks cloud metadata / link-local IPv4', () => {
    expect(isUrlSafeToFetch('http://169.254.169.254/latest/meta-data')).toBe(
      false,
    )
  })

  test('blocks RFC1918 private IPv4', () => {
    expect(isUrlSafeToFetch('http://192.168.1.1/')).toBe(false)
  })

  test('blocks non-http(s) schemes', () => {
    expect(isUrlSafeToFetch('ftp://example.com')).toBe(false)
  })

  test('blocks localhost', () => {
    expect(isUrlSafeToFetch('http://localhost:3000')).toBe(false)
  })

  test('blocks 10.0.0.0/8', () => {
    expect(isUrlSafeToFetch('http://10.1.2.3/')).toBe(false)
  })

  test('blocks 172.16.0.0/12', () => {
    expect(isUrlSafeToFetch('http://172.20.0.1/')).toBe(false)
  })

  test('blocks IPv6 loopback', () => {
    expect(isUrlSafeToFetch('http://[::1]/')).toBe(false)
  })

  test('blocks an unparseable URL', () => {
    expect(isUrlSafeToFetch('not a url')).toBe(false)
  })

  // Regression test for bug 1: a bare `startsWith('fc'/'fd')` check applied
  // to every hostname wrongly rejected real domains that merely start with
  // those letters. The check must only apply to actual IPv6 literals.
  test('allows real hostnames that happen to start with fc/fd', () => {
    expect(isUrlSafeToFetch('https://fcbarcelona.com/news')).toBe(true)
    expect(isUrlSafeToFetch('https://fdic.gov/')).toBe(true)
  })

  // Regression test for bug 2: Node's URL parser normalizes IPv4-mapped
  // IPv6 addresses (e.g. ::ffff:127.0.0.1) to a hex form (::ffff:7f00:1)
  // that didn't match any of the original loopback/private-range checks,
  // letting a loopback address slip through.
  test('blocks IPv4-mapped IPv6 loopback', () => {
    expect(isUrlSafeToFetch('http://[::ffff:127.0.0.1]/')).toBe(false)
  })
})

describe('safeFetch', () => {
  test('returns the response directly when there is no redirect', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }))
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res?.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('follows a redirect to another safe target', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.com/img.jpg' },
        }),
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res?.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://cdn.example.com/img.jpg',
      expect.anything(),
    )
  })

  // The bug this guards against: the initial URL passes isUrlSafeToFetch,
  // but the site 30x's to a private/loopback target. Without re-validating
  // each hop, `fetch`'s default redirect-following would still reach it.
  test('refuses to follow a redirect into a private/loopback target', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    )
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('refuses to follow a relative redirect that resolves to localhost', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: '//localhost:1/internal' },
      }),
    )
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test('gives up after too many redirects instead of looping forever', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/next' },
        }),
    )
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res).toBeUndefined()
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1)
    expect(fetchImpl.mock.calls.length).toBeLessThan(10)
  })

  test('returns undefined when a redirect has no Location header', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302 }))
    const res = await safeFetch('https://example.com/page', undefined, fetchImpl)
    expect(res).toBeUndefined()
  })
})
