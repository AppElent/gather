import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startFetch: vi.fn(),
  sentryFetch: vi.fn(),
}))

vi.mock('@tanstack/react-start/server-entry', () => ({
  default: { fetch: mocks.startFetch },
}))
vi.mock('@sentry/cloudflare', () => ({
  withSentry: () => ({ fetch: mocks.sentryFetch }),
  setTag: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

const ctx = {} as ExecutionContext

it('bypasses Sentry for a local SSR failure', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o1.ingest.sentry.io/1')
  const { default: server } = await import('../../server')
  const response = new Response('SSR failure', { status: 500 })
  mocks.startFetch.mockResolvedValue(response)
  const request = new Request('http://localhost:3100/')

  expect(await server.fetch(request, {}, ctx)).toBe(response)
  expect(mocks.startFetch).toHaveBeenCalledWith(request)
  expect(mocks.sentryFetch).not.toHaveBeenCalled()
})

it('enters the Sentry wrapper for deployed requests', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o1.ingest.sentry.io/1')
  const { default: server } = await import('../../server')
  const response = new Response('ok')
  mocks.sentryFetch.mockResolvedValue(response)
  const request = new Request('https://gather.example.workers.dev/')

  expect(await server.fetch(request, {}, ctx)).toBe(response)
  expect(mocks.sentryFetch).toHaveBeenCalledWith(request, {}, ctx)
  expect(mocks.startFetch).not.toHaveBeenCalled()
})

it('skips Sentry entirely when no DSN is configured', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', '')
  const { default: server } = await import('../../server')
  const response = new Response('ok')
  mocks.startFetch.mockResolvedValue(response)
  const request = new Request('https://gather.example.workers.dev/')

  expect(await server.fetch(request, {}, ctx)).toBe(response)
  expect(mocks.sentryFetch).not.toHaveBeenCalled()
})
