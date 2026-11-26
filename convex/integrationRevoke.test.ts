/**
 * A token Gather drops is revoked at the provider, best effort (APP-909):
 * disconnecting, replacing a connection, deleting its Group, and a connect
 * refused after the provider answered.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import { revokeProviderToken } from './lib/taskProviders/revoke'

const HOME = 'revoke-home'
const CALLBACK = 'https://gather.example/integrations/callback'

type Call = { url: string; init: RequestInit }

/** Provider answers: a token exchange hands out `issued`, a revoke `revoke`. */
function provider(issued: string, revoke = () => new Response(null, { status: 200 })) {
  const revokes: Call[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/revoke')) {
      revokes.push({ url, init })
      return revoke()
    }
    return Response.json({ access_token: issued, workspace_name: 'Notes' })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { revokes, fetchMock }
}

/** The token each revoke named, from whichever body format it used. */
function revokedTokens(revokes: Call[]) {
  return revokes.map(({ url, init }) => {
    const body = String(init.body)
    return url.includes('notion.com')
      ? ['notion', JSON.parse(body).token]
      : ['todoist', new URLSearchParams(body).get('token')]
  })
}

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: 'Alice',
      email: alice.email,
    })
    const home = await seedGroup(ctx, { name: 'Home', slug: HOME })
    await seedMember(ctx, home, aliceId, 'admin')
    const connect = (provider: 'todoist' | 'notion') =>
      ctx.db.insert('integrationConnections', {
        groupId: home,
        provider,
        accessToken: `old-${provider}`,
        accountLabel: provider,
        connectedBy: aliceId,
      })
    return {
      aliceId,
      home,
      todoist: await connect('todoist'),
      notion: await connect('notion'),
    }
  })
  const settle = () => t.finishAllScheduledFunctions(vi.runAllTimers)
  const tokens = () =>
    t.run(async (ctx) =>
      (await ctx.db.query('integrationConnections').collect()).map((r) => [
        r.provider,
        r.accessToken,
      ]),
    )
  return { t, ...ids, settle, tokens }
}

beforeEach(() => {
  vi.useFakeTimers()
  for (const name of ['TODOIST', 'NOTION']) {
    vi.stubEnv(`${name}_CLIENT_ID`, `${name.toLowerCase()}-client`)
    vi.stubEnv(`${name}_CLIENT_SECRET`, `${name.toLowerCase()}-secret`)
  }
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the revoke request', () => {
  const client = { clientId: 'id', clientSecret: 'shh' }
  const basic = `Basic ${btoa('id:shh')}`

  test("Todoist's goes to its RFC 7009 endpoint with the client's credentials", async () => {
    const { revokes } = provider('unused')
    expect(await revokeProviderToken('todoist', 'tok', client)).toBe(true)
    expect(revokes).toHaveLength(1)
    const [{ url, init }] = revokes
    expect(url).toBe('https://api.todoist.com/api/v1/revoke')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      token: 'tok',
      token_type_hint: 'access_token',
    })
  })

  test("Notion's goes to /v1/oauth/revoke with the client's credentials", async () => {
    const { revokes } = provider('unused')
    expect(await revokeProviderToken('notion', 'tok', client)).toBe(true)
    const [{ url, init }] = revokes
    expect(url).toBe('https://api.notion.com/v1/oauth/revoke')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: basic,
      'Content-Type': 'application/json',
      'Notion-Version': '2026-03-11',
    })
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok' })
  })

  test('a refusal or a network failure is false, not a throw', async () => {
    provider('unused', () => new Response(null, { status: 400 }))
    expect(await revokeProviderToken('todoist', 'tok', client)).toBe(false)
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline')
    })
    expect(await revokeProviderToken('notion', 'tok', client)).toBe(false)
  })
})

describe('a dropped token is revoked', () => {
  test('disconnecting revokes that connection, and only that one', async () => {
    const { t, todoist, settle, tokens } = await seed()
    const { revokes } = provider('unused')
    await t
      .withIdentity(alice)
      .mutation(api.integrations.disconnect, { connectionId: todoist, groupSlug: HOME })
    await settle()
    expect(revokedTokens(revokes)).toEqual([['todoist', 'old-todoist']])
    expect(revokes[0].init.headers).toMatchObject({
      Authorization: `Basic ${btoa('todoist-client:todoist-secret')}`,
    })
    expect(await tokens()).toEqual([['notion', 'old-notion']])
  })

  test('a token another Group still holds is not revoked', async () => {
    const { t, todoist, settle, tokens } = await seed()
    // The same person connected the same Todoist account in a second Group,
    // and Todoist handed back the same token.
    await t.run(async (ctx) => {
      const club = await seedGroup(ctx, { name: 'Club', slug: 'revoke-club' })
      const userId = (await ctx.db.get(todoist))!.connectedBy
      await seedMember(ctx, club, userId, 'admin')
      await ctx.db.insert('integrationConnections', {
        groupId: club,
        provider: 'todoist',
        accessToken: 'old-todoist',
        accountLabel: 'Todoist',
        connectedBy: userId,
      })
    })
    const { revokes } = provider('unused')
    await t
      .withIdentity(alice)
      .mutation(api.integrations.disconnect, { connectionId: todoist, groupSlug: HOME })
    await settle()
    expect(revokes).toEqual([])
    expect((await tokens()).sort()).toEqual([
      ['notion', 'old-notion'],
      ['todoist', 'old-todoist'],
    ])
  })

  test('a failed revoke still leaves the connection deleted', async () => {
    const { t, notion, settle, tokens } = await seed()
    const { revokes } = provider('unused', () => new Response(null, { status: 500 }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await t
      .withIdentity(alice)
      .mutation(api.integrations.disconnect, { connectionId: notion, groupSlug: HOME })
    await settle()
    expect(revokedTokens(revokes)).toEqual([['notion', 'old-notion']])
    expect(await tokens()).toEqual([['todoist', 'old-todoist']])
    // The log says what failed and never carries the token.
    expect(warn).toHaveBeenCalledWith('Could not revoke a dropped notion token')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('old-notion')
    warn.mockRestore()
  })

  test('reconnecting revokes the token it replaces', async () => {
    const { t, settle, tokens } = await seed()
    const { revokes } = provider('new-todoist')
    await t.withIdentity(alice).action(api.integrations.completeOAuth, {
      provider: 'todoist',
      groupSlug: HOME,
      code: 'code',
      redirectUri: CALLBACK,
    })
    await settle()
    expect(revokedTokens(revokes)).toEqual([['todoist', 'old-todoist']])
    expect((await tokens()).sort()).toEqual([
      ['notion', 'old-notion'],
      ['todoist', 'new-todoist'],
    ])
  })

  test("deleting a Group revokes each of its connections' tokens", async () => {
    const { t, home, settle, tokens } = await seed()
    const { revokes } = provider('unused')
    await t.withIdentity(alice).mutation(api.groups.deleteGroup, { groupId: home })
    await settle()
    expect(revokedTokens(revokes).sort()).toEqual([
      ['notion', 'old-notion'],
      ['todoist', 'old-todoist'],
    ])
    expect(await tokens()).toEqual([])
  })

  test('a connect refused because the Group went revokes the token it was given', async () => {
    const { t, home, settle, tokens } = await seed()
    const revokes: Call[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (url.endsWith('/revoke')) {
        revokes.push({ url, init })
        return new Response(null, { status: 200 })
      }
      await t.withIdentity(alice).mutation(api.groups.deleteGroup, { groupId: home })
      return Response.json({ access_token: 'fresh-notion' })
    })
    await expect(
      t.withIdentity(alice).action(api.integrations.completeOAuth, {
        provider: 'notion',
        groupSlug: HOME,
        code: 'code',
        redirectUri: CALLBACK,
      }),
    ).rejects.toThrow('groups:unknown-group')
    await settle()
    expect(revokedTokens(revokes).sort()).toEqual([
      ['notion', 'fresh-notion'],
      ['notion', 'old-notion'],
      ['todoist', 'old-todoist'],
    ])
    expect(await tokens()).toEqual([])
  })
})
