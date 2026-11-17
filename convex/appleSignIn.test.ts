import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { alice, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import { APPLE_REVOCATION } from './accounts'
import { clientSecret, isAppleClientId } from './lib/appleSignIn'
import { CONNECTED_APP_REFUSED } from './lib/connectedApps'
import { NOT_SIGNED_IN } from './lib/sharing'

/**
 * Revoking Sign in with Apple on account deletion (APP-213), against a fake
 * Apple: the token exchange and the revoke are the whole contract.
 */

async function appleKey() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const der = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', pair.privateKey),
  )
  const body = btoa(String.fromCharCode(...der))
    .match(/.{1,64}/g)
    ?.join('\n')
  return {
    publicKey: pair.publicKey,
    pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
  }
}

function decode(part: string) {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

async function configure() {
  const key = await appleKey()
  vi.stubEnv('APPLE_TEAM_ID', 'TEAM123456')
  vi.stubEnv('APPLE_SIGN_IN_KEY_ID', 'KEY1234567')
  // Infisical exports may carry the newlines escaped.
  vi.stubEnv('APPLE_SIGN_IN_PRIVATE_KEY', key.pem.replace(/\n/g, '\\n'))
  return key
}

function appleResponses(responses: Record<string, Response>) {
  const calls: { path: string; form: URLSearchParams }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname
      calls.push({ path, form: new URLSearchParams(String(init.body)) })
      return responses[path] ?? new Response('not_found', { status: 404 })
    }),
  )
  return { calls }
}

/** The message a ConvexError carries, whatever shape the harness gives it. */
async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return (error as { data?: unknown }).data
  }
  throw new Error('expected a refusal')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Sign in with Apple client secret', () => {
  test('is an ES256 JWT for the bundle ID, signed with the Apple key', async () => {
    const key = await appleKey()
    const now = Date.UTC(2026, 10, 17)
    const jwt = await clientSecret(
      { teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: key.pem },
      'com.appelent.gather',
      now,
    )
    const [header, claims, signature] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(decode(header)))).toEqual({
      alg: 'ES256',
      kid: 'KEY1234567',
    })
    expect(JSON.parse(new TextDecoder().decode(decode(claims)))).toEqual({
      iss: 'TEAM123456',
      iat: now / 1000,
      exp: now / 1000 + 300,
      aud: 'https://appleid.apple.com',
      sub: 'com.appelent.gather',
    })
    await expect(
      crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key.publicKey,
        decode(signature),
        new TextEncoder().encode(`${header}.${claims}`),
      ),
    ).resolves.toBe(true)
  })
})

describe('accounts.revokeAppleSignIn', () => {
  const args = { authorizationCode: 'code', bundleId: 'com.appelent.gather' }

  test('requires a signed-in account', async () => {
    await configure()
    const { calls } = appleResponses({})
    const t = testConvex()
    expect(await refusal(t.action(api.accounts.revokeAppleSignIn, args))).toBe(
      NOT_SIGNED_IN,
    )
    expect(calls).toEqual([])
  })

  test('refuses a connected app, as the rest of account deletion does', async () => {
    await configure()
    const { calls } = appleResponses({})
    const app = testConvex().withIdentity({
      ...alice,
      client_id: 'mcp-client',
      scope: 'gather:read gather:write',
    })
    expect(
      await refusal(app.action(api.accounts.revokeAppleSignIn, args)),
    ).toBe(CONNECTED_APP_REFUSED)
    expect(calls).toEqual([])
  })

  test('reports missing Apple credentials instead of calling Apple', async () => {
    const { calls } = appleResponses({})
    const t = testConvex().withIdentity(alice)
    expect(await refusal(t.action(api.accounts.revokeAppleSignIn, args))).toBe(
      APPLE_REVOCATION.unavailable,
    )
    expect(calls).toEqual([])
  })

  test('rejects a bundle ID that is not a Gather build', async () => {
    await configure()
    const { calls } = appleResponses({})
    const t = testConvex().withIdentity(alice)
    expect(
      await refusal(
        t.action(api.accounts.revokeAppleSignIn, {
          ...args,
          bundleId: 'com.appelent.foundry',
        }),
      ),
    ).toBe(APPLE_REVOCATION.invalidBundleId)
    expect(calls).toEqual([])
  })

  test('rejects an empty or oversized code', async () => {
    await configure()
    const { calls } = appleResponses({})
    const t = testConvex().withIdentity(alice)
    for (const authorizationCode of ['', 'x'.repeat(2001)]) {
      expect(
        await refusal(
          t.action(api.accounts.revokeAppleSignIn, {
            ...args,
            authorizationCode,
          }),
        ),
      ).toBe(APPLE_REVOCATION.invalidCode)
    }
    expect(calls).toEqual([])
  })

  test('uses the bundle ID of the build that asked', async () => {
    await configure()
    const { calls } = appleResponses({
      '/auth/token': Response.json({ refresh_token: 'refresh' }),
      '/auth/revoke': new Response(null, { status: 200 }),
    })
    const t = testConvex().withIdentity(alice)
    await t.action(api.accounts.revokeAppleSignIn, {
      ...args,
      bundleId: 'com.appelent.gather.preview',
    })
    expect(calls.map(({ form }) => form.get('client_id'))).toEqual([
      'com.appelent.gather.preview',
      'com.appelent.gather.preview',
    ])
  })

  test('exchanges the code and revokes the refresh token', async () => {
    await configure()
    const { calls } = appleResponses({
      '/auth/token': Response.json({
        access_token: 'access',
        refresh_token: 'refresh',
      }),
      '/auth/revoke': new Response(null, { status: 200 }),
    })
    const t = testConvex().withIdentity(alice)
    await t.action(api.accounts.revokeAppleSignIn, args)
    expect(calls.map(({ path }) => path)).toEqual([
      '/auth/token',
      '/auth/revoke',
    ])
    const [exchange, revoke] = calls.map(({ form }) =>
      Object.fromEntries(form),
    )
    expect(exchange).toMatchObject({
      client_id: 'com.appelent.gather',
      code: 'code',
      grant_type: 'authorization_code',
    })
    expect(revoke).toMatchObject({
      client_id: 'com.appelent.gather',
      token: 'refresh',
      token_type_hint: 'refresh_token',
    })
    expect(revoke.client_secret).toBe(exchange.client_secret)
  })

  test('fails with one stable message when Apple rejects the code', async () => {
    await configure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls } = appleResponses({
      '/auth/token': Response.json({ error: 'invalid_grant' }, { status: 400 }),
    })
    const t = testConvex().withIdentity(alice)
    expect(await refusal(t.action(api.accounts.revokeAppleSignIn, args))).toBe(
      APPLE_REVOCATION.failed,
    )
    expect(calls.map(({ path }) => path)).toEqual(['/auth/token'])
  })

  test('fails with the same message when the revoke itself is refused', async () => {
    await configure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls } = appleResponses({
      '/auth/token': Response.json({ refresh_token: 'refresh' }),
      '/auth/revoke': Response.json({ error: 'invalid_client' }, { status: 400 }),
    })
    const t = testConvex().withIdentity(alice)
    expect(await refusal(t.action(api.accounts.revokeAppleSignIn, args))).toBe(
      APPLE_REVOCATION.failed,
    )
    expect(calls.map(({ path }) => path)).toEqual(['/auth/token', '/auth/revoke'])
  })

  test('every Gather install variant is a known client', async () => {
    const config = readFileSync(
      new URL('../apps/mobile/app.config.ts', import.meta.url),
      'utf8',
    )
    const suffixes = [...config.matchAll(/suffix: '([^']*)'/g)].map((m) => m[1])
    expect(suffixes.length).toBeGreaterThan(0)
    for (const suffix of suffixes)
      expect(isAppleClientId(`com.appelent.gather${suffix}`)).toBe(true)
  })
})
