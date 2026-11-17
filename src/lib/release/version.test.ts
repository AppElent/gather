import { afterEach, expect, it, vi } from 'vitest'
import { versionResponse } from './version'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('reports the inlined version, commit and release with the environment from the hostname', async () => {
  vi.stubEnv('VITE_APP_VERSION', '1.2.3')
  vi.stubEnv('VITE_GIT_COMMIT', 'a1b2c3d4e5f6')
  vi.stubEnv('VITE_BUILT_AT', '2026-11-17T08:00:00.000Z')
  vi.stubEnv('VITE_SENTRY_RELEASE', 'gather@1.2.3+a1b2c3d')

  const response = versionResponse(new Request('https://gather-stg.appelent.nl/version'))

  expect(response?.headers.get('cache-control')).toBe('no-store')
  expect(await response?.json()).toEqual({
    app: 'gather',
    version: '1.2.3',
    commit: 'a1b2c3d4e5f6',
    environment: 'staging',
    deployedAt: '2026-11-17T08:00:00.000Z',
    release: 'gather@1.2.3+a1b2c3d',
  })
})

it('calls the bare custom domain production', async () => {
  const response = versionResponse(new Request('https://gather.appelent.nl/version'))
  expect((await response?.json()).environment).toBe('production')
})

it('leaves every other path and method to the app', () => {
  expect(versionResponse(new Request('https://gather.appelent.nl/'))).toBeUndefined()
  expect(versionResponse(new Request('https://gather.appelent.nl/version/x'))).toBeUndefined()
  expect(
    versionResponse(new Request('https://gather.appelent.nl/version', { method: 'POST' })),
  ).toBeUndefined()
})

it('answers HEAD without a body', async () => {
  const response = versionResponse(
    new Request('https://gather.appelent.nl/version', { method: 'HEAD' }),
  )
  expect(response?.status).toBe(200)
  expect(await response?.text()).toBe('')
})
