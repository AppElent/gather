import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { ACCOUNT_CHANGED, APPLE_REVOCATION } from './accounts'
import { clientSecret, isAppleClientId } from './lib/appleSignIn'
import { verifiedAppleUserIds } from './lib/clerkUsers'
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

  test('revokes the access token when Apple returns no refresh token', async () => {
    await configure()
    const { calls } = appleResponses({
      '/auth/token': Response.json({ access_token: 'access' }),
      '/auth/revoke': new Response(null, { status: 200 }),
    })
    const t = testConvex().withIdentity(alice)
    await t.action(api.accounts.revokeAppleSignIn, args)
    expect(Object.fromEntries(calls[1].form)).toMatchObject({
      token: 'access',
      token_type_hint: 'access_token',
    })
  })
})

/**
 * Web revocation (APP-388): an Apple JS popup's code, issued to the web
 * Services ID, is exchanged only when the whole-account deletion would go
 * ahead, and revoked only when its Apple user is one the Clerk webhook
 * mirrored for the caller.
 */
describe('accounts.revokeAppleSignIn from the web', () => {
  const WEB = {
    authorizationCode: 'code',
    bundleId: 'nl.appelent.web',
    redirectUri: 'https://gather.appelent.nl/account',
    expectedSubject: alice.subject,
  }

  function idToken(claims: Record<string, unknown>) {
    const part = (value: unknown) =>
      btoa(JSON.stringify(value))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    return `${part({ alg: 'RS256' })}.${part(claims)}.signature`
  }

  function appleToken(sub: string, overrides: Record<string, unknown> = {}) {
    return Response.json({
      refresh_token: 'refresh',
      id_token: idToken({
        iss: 'https://appleid.apple.com',
        aud: 'nl.appelent.web',
        sub,
        ...overrides,
      }),
    })
  }

  /** Alice with a Gather account, and her Apple link as the webhook
   * mirrors it; none when empty. */
  async function setUp(
    responses: Record<string, Response>,
    appleUserIds: string[] = ['apple-alice'],
    { account = true } = {},
  ) {
    await configure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { calls } = appleResponses(responses)
    const t = testConvex()
    if (account) await t.withIdentity(alice).mutation(api.users.ensureUser, {})
    if (appleUserIds.length > 0)
      await t.mutation(internal.accounts.syncAppleLink, {
        clerkId: alice.subject,
        appleUserIds,
        clerkUpdatedAt: 1,
      })
    return { calls, t, signedIn: t.withIdentity(alice) }
  }

  const paths = (calls: { path: string }[]) => calls.map(({ path }) => path)
  const revoked = {
    '/auth/token': appleToken('apple-alice'),
    '/auth/revoke': new Response(null, { status: 200 }),
  }

  test('revokes when the code is for the Apple user mirrored for the caller', async () => {
    const { signedIn, calls } = await setUp(revoked)
    await signedIn.action(api.accounts.revokeAppleSignIn, WEB)
    expect(paths(calls)).toEqual(['/auth/token', '/auth/revoke'])
    const [exchange, revoke] = calls.map(({ form }) => Object.fromEntries(form))
    expect(exchange).toMatchObject({
      client_id: 'nl.appelent.web',
      code: 'code',
      redirect_uri: 'https://gather.appelent.nl/account',
    })
    expect(revoke).toMatchObject({
      client_id: 'nl.appelent.web',
      token: 'refresh',
    })
  })

  test("binds to the caller's link, not another login's", async () => {
    const { t, signedIn, calls } = await setUp({
      '/auth/token': appleToken('apple-bob'),
      '/auth/revoke': new Response(null, { status: 200 }),
    })
    await t.mutation(internal.accounts.syncAppleLink, {
      clerkId: bob.subject,
      appleUserIds: ['apple-bob'],
      clerkUpdatedAt: 1,
    })
    expect(
      await refusal(signedIn.action(api.accounts.revokeAppleSignIn, WEB)),
    ).toBe(APPLE_REVOCATION.mismatch)
    expect(paths(calls)).toEqual(['/auth/token'])
  })

  test('refuses an ID token for another audience or issuer, or none', async () => {
    for (const token of [
      appleToken('apple-alice', { aud: 'com.example.other' }),
      appleToken('apple-alice', { iss: 'https://evil.example' }),
      Response.json({ refresh_token: 'refresh' }),
    ]) {
      const { signedIn, calls } = await setUp({
        '/auth/token': token,
        '/auth/revoke': new Response(null, { status: 200 }),
      })
      expect(
        await refusal(signedIn.action(api.accounts.revokeAppleSignIn, WEB)),
      ).toBe(APPLE_REVOCATION.mismatch)
      expect(paths(calls)).not.toContain('/auth/revoke')
    }
  })

  test('does not exchange the code without a mirrored Apple link', async () => {
    const { signedIn, calls } = await setUp(revoked, [])
    expect(
      await refusal(signedIn.action(api.accounts.revokeAppleSignIn, WEB)),
    ).toBe(APPLE_REVOCATION.mismatch)
    expect(calls).toEqual([])
  })

  test('checks the deletion would go ahead before exchanging the code', async () => {
    // No Gather account: the whole-account deletion refuses, so Apple's
    // grant, which cannot be restored, is not touched.
    const noAccount = await setUp(revoked, ['apple-alice'], { account: false })
    expect(
      await refusal(
        noAccount.signedIn.action(api.accounts.revokeAppleSignIn, WEB),
      ),
    ).toBe(NOT_SIGNED_IN)
    expect(noAccount.calls).toEqual([])

    // Another account signed in since the person confirmed.
    const changed = await setUp(revoked)
    expect(
      await refusal(
        changed.signedIn.action(api.accounts.revokeAppleSignIn, {
          ...WEB,
          expectedSubject: bob.subject,
        }),
      ),
    ).toBe(ACCOUNT_CHANGED)
    const { expectedSubject: _, ...unbound } = WEB
    expect(
      await refusal(
        changed.signedIn.action(api.accounts.revokeAppleSignIn, unbound),
      ),
    ).toBe(ACCOUNT_CHANGED)
    expect(changed.calls).toEqual([])
  })

  test('refuses an unregistered return URL, or none, before any lookup', async () => {
    const { signedIn, calls } = await setUp(revoked)
    for (const redirectUri of [
      'https://gather-stg.appelent.nl/account',
      'https://evil.example/account',
      undefined,
    ])
      expect(
        await refusal(
          signedIn.action(api.accounts.revokeAppleSignIn, {
            ...WEB,
            redirectUri,
          }),
        ),
      ).toBe(APPLE_REVOCATION.invalidRedirectUri)
    expect(calls).toEqual([])
  })

  test('refuses a connected app before any lookup', async () => {
    const { t, calls } = await setUp(revoked)
    const app = t.withIdentity({
      ...alice,
      client_id: 'mcp-client',
      scope: 'gather:read gather:write',
    })
    expect(await refusal(app.action(api.accounts.revokeAppleSignIn, WEB))).toBe(
      CONNECTED_APP_REFUSED,
    )
    expect(calls).toEqual([])
  })

  test('keeps native revocation as installed phones call it: unbound, no return URL', async () => {
    const { signedIn, calls } = await setUp(
      {
        '/auth/token': appleToken('apple-someone', {
          aud: 'com.appelent.gather',
        }),
        '/auth/revoke': new Response(null, { status: 200 }),
      },
      [],
    )
    await signedIn.action(api.accounts.revokeAppleSignIn, {
      authorizationCode: 'code',
      bundleId: 'com.appelent.gather',
    })
    expect(paths(calls)).toEqual(['/auth/token', '/auth/revoke'])
    expect(calls[0].form.get('redirect_uri')).toBeNull()
    expect(
      await refusal(
        signedIn.action(api.accounts.revokeAppleSignIn, {
          authorizationCode: 'code',
          bundleId: 'com.appelent.gather',
          redirectUri: WEB.redirectUri,
        }),
      ),
    ).toBe(APPLE_REVOCATION.invalidRedirectUri)
  })
})

describe('Apple link mirror', () => {
  const links = (t: ReturnType<typeof testConvex>) =>
    t.run((ctx) => ctx.db.query('appleSignInLinks').collect())

  test('keeps the newest delivery and drops the row when Apple is unlinked', async () => {
    const t = testConvex()
    const sync = (appleUserIds: string[], clerkUpdatedAt: number) =>
      t.mutation(internal.accounts.syncAppleLink, {
        clerkId: alice.subject,
        appleUserIds,
        clerkUpdatedAt,
      })
    await sync(['apple-1'], 10)
    await sync(['apple-1'], 10)
    await sync(['apple-old'], 5)
    expect(await links(t)).toMatchObject([
      { clerkId: alice.subject, appleUserIds: ['apple-1'], clerkUpdatedAt: 10 },
    ])
    await sync(['apple-2'], 20)
    expect((await links(t))[0].appleUserIds).toEqual(['apple-2'])
    await sync([], 30)
    expect(await links(t)).toEqual([])
  })

  test('backfills in bounded batches with the same rules', async () => {
    const t = testConvex()
    await t.mutation(internal.accounts.syncAppleLink, {
      clerkId: alice.subject,
      appleUserIds: ['apple-new'],
      clerkUpdatedAt: 20,
    })
    await t.mutation(internal.accounts.backfillAppleLinks, {
      links: [
        { clerkId: alice.subject, appleUserIds: ['apple-stale'], clerkUpdatedAt: 10 },
        { clerkId: bob.subject, appleUserIds: ['apple-bob'], clerkUpdatedAt: 10 },
      ],
    })
    expect(
      (await links(t))
        .map(({ clerkId, appleUserIds }) => [clerkId, appleUserIds])
        .sort(),
    ).toEqual(
      [
        [alice.subject, ['apple-new']],
        [bob.subject, ['apple-bob']],
      ].sort(),
    )
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      clerkId: `user_${i}`,
      appleUserIds: ['apple'],
      clerkUpdatedAt: 1,
    }))
    await expect(
      t.mutation(internal.accounts.backfillAppleLinks, { links: tooMany }),
    ).rejects.toThrow()
  })

  test('reads only verified Apple accounts from a Clerk user', () => {
    expect(
      verifiedAppleUserIds({
        external_accounts: [
          { provider: 'oauth_apple', provider_user_id: 'a', verification: { status: 'verified' } },
          { provider: 'apple', provider_user_id: 'b', verification: { status: 'verified' } },
          { provider: 'oauth_apple', provider_user_id: 'a', verification: { status: 'verified' } },
          { provider: 'oauth_apple', provider_user_id: 'c', verification: { status: 'unverified' } },
          { provider: 'oauth_apple', provider_user_id: 'd', verification: null },
          { provider: 'oauth_google', provider_user_id: 'e', verification: { status: 'verified' } },
          { provider: 'oauth_apple', provider_user_id: '', verification: { status: 'verified' } },
          null,
        ],
      }),
    ).toEqual(['a', 'b'])
    expect(verifiedAppleUserIds({})).toEqual([])
    expect(verifiedAppleUserIds({ external_accounts: 'nope' })).toEqual([])
  })
})
