import { expect, it } from 'vitest'
import { isProbePath, probeResponse } from './probe'

it.each([
  '/.ssh/id_ed25519',
  '/.env',
  '/.git/config',
  '/.aws/credentials',
  '/admin/.env',
  '/.well-known/../.env',
  '/.well-known/.git/config',
  '/wp-login.php',
  '/cgi-bin/test.cgi',
  '/backup.sql',
  '/default.aspx',
])('treats %s as a probe', (path) => {
  expect(isProbePath(path)).toBe(true)
})

it.each([
  '/',
  '/about',
  '/sign-in',
  '/recipes/abc123',
  '/does-not-exist',
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server/mcp',
  '/manifest.webmanifest',
  '/robots.txt',
  '/version',
])('leaves %s to the app', (path) => {
  expect(isProbePath(path)).toBe(false)
})

it('answers a probe with a plain 404 (APP-466, Sentry GATHER-4)', async () => {
  const response = probeResponse(
    new Request('https://gather.appelent.nl/.ssh/id_ed25519'),
  )

  expect(response?.status).toBe(404)
  expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8')
  expect(await response?.text()).toBe('Not Found')
})

it('answers a HEAD probe without a body', async () => {
  const response = probeResponse(
    new Request('https://gather.appelent.nl/.env', { method: 'HEAD' }),
  )

  expect(response?.status).toBe(404)
  expect(await response?.text()).toBe('')
})

it('returns undefined for an app path', () => {
  expect(probeResponse(new Request('https://gather.appelent.nl/about'))).toBeUndefined()
})
