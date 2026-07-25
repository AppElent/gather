import { expect, test, vi } from 'vitest'
import { type ClerkGetToken, fetchClerkConvexToken } from './clerkToken'

const noWait = () => Promise.resolve()

const options = {
  sessionTargetsConvex: false,
  forceRefreshToken: false,
  wait: noWait,
}

test('returns the token Clerk mints on the first attempt', async () => {
  const getToken = vi.fn(async () => 'token-1') as unknown as ClerkGetToken

  await expect(fetchClerkConvexToken(getToken, options)).resolves.toBe(
    'token-1',
  )
  expect(getToken).toHaveBeenCalledTimes(1)
  expect(getToken).toHaveBeenCalledWith({
    template: 'convex',
    skipCache: false,
  })
})

test('skips the JWT template when the session already targets Convex', async () => {
  const getToken = vi.fn(async () => 'token-1') as unknown as ClerkGetToken

  await fetchClerkConvexToken(getToken, {
    ...options,
    sessionTargetsConvex: true,
  })

  expect(getToken).toHaveBeenCalledWith({ skipCache: false })
})

test('retries when Clerk rejects, so a transient failure still authenticates', async () => {
  const getToken = vi
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce('token-2') as unknown as ClerkGetToken

  await expect(fetchClerkConvexToken(getToken, options)).resolves.toBe(
    'token-2',
  )
  expect(getToken).toHaveBeenCalledTimes(2)
})

test('retries when Clerk resolves null instead of a token', async () => {
  const getToken = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('token-2') as unknown as ClerkGetToken

  await expect(fetchClerkConvexToken(getToken, options)).resolves.toBe(
    'token-2',
  )
})

test('bypasses Clerk cache on retries so a cached miss cannot repeat', async () => {
  const getToken = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('token-2') as unknown as ClerkGetToken

  await fetchClerkConvexToken(getToken, options)

  expect(getToken).toHaveBeenNthCalledWith(1, {
    template: 'convex',
    skipCache: false,
  })
  expect(getToken).toHaveBeenNthCalledWith(2, {
    template: 'convex',
    skipCache: true,
  })
})

test('retries a getToken call that never settles', async () => {
  const getToken = vi
    .fn()
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce('token-2') as unknown as ClerkGetToken

  await expect(
    fetchClerkConvexToken(getToken, { ...options, timeoutMs: 5 }),
  ).resolves.toBe('token-2')
})

test('gives up with null once the attempt budget is spent', async () => {
  const getToken = vi.fn(async () => null) as unknown as ClerkGetToken

  await expect(
    fetchClerkConvexToken(getToken, { ...options, attempts: 3 }),
  ).resolves.toBeNull()
  expect(getToken).toHaveBeenCalledTimes(3)
})

test('waits between attempts with a growing delay', async () => {
  const waits: number[] = []
  const getToken = vi.fn(async () => null) as unknown as ClerkGetToken

  await fetchClerkConvexToken(getToken, {
    ...options,
    attempts: 3,
    wait: async (ms) => {
      waits.push(ms)
    },
  })

  expect(waits).toHaveLength(2)
  expect(waits[1]).toBeGreaterThan(waits[0])
})
