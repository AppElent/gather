/**
 * Connected apps (MCP clients with a Clerk OAuth token) at the Convex
 * boundary: the read/write split, the administration they never reach, and
 * idempotent creates (ADR-0046).
 */
import { describe, expect, test } from 'vitest'
import { seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import {
  CONNECTED_APP_NO_ACCESS,
  CONNECTED_APP_READ_ONLY,
  CONNECTED_APP_REFUSED,
} from './lib/connectedApps'
import {
  IDEMPOTENCY_KEY_REQUIRED,
  IDEMPOTENCY_KEY_REUSED,
} from './lib/idempotency'

const person = { subject: 'mcp_ada', name: 'Ada', email: 'ada@example.com' }
const app = (scope: string) => ({
  ...person,
  client_id: 'client_claude',
  scope,
})
const KEY = '0b8a3d4e-1f2a-4c5b-9d6e-7f8091a2b3c4'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: person.subject,
      name: person.name,
      email: person.email,
    })
    const groupId = await seedGroup(ctx, { name: 'Home', slug: 'mcp-home' })
    await seedMember(ctx, groupId, userId, 'admin')
    const listId = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Groceries',
      provider: 'local',
      order: 0,
    })
    const calendarId = await ctx.db.insert('calendars', {
      groupId,
      name: 'Family',
      source: 'local',
      createdBy: userId,
    })
    return { userId, groupId, listId, calendarId }
  })
  return { t, ...ids }
}

describe('the connected-app gate', () => {
  test('a read grant reads but cannot write', async () => {
    const { t } = await seed()
    const reader = t.withIdentity(app('openid gather:read'))
    expect(await reader.query(api.notes.list, { groupSlug: 'mcp-home' })).toEqual(
      [],
    )
    await expect(
      reader.mutation(api.notes.create, {
        groupSlug: 'mcp-home',
        title: 'x',
        body: 'y',
      }),
    ).rejects.toThrow(CONNECTED_APP_READ_ONLY)
  })

  test('a read grant cannot run an action, which could write', async () => {
    const { t, listId } = await seed()
    await expect(
      t
        .withIdentity(app('gather:read'))
        .action(api.taskLists.getTasks, { groupSlug: 'mcp-home', listId }),
    ).rejects.toThrow(CONNECTED_APP_READ_ONLY)
    await expect(
      t.withIdentity(app('gather:read')).action(api.integrations.completeOAuth, {
        provider: 'notion',
        groupSlug: 'mcp-home',
        code: 'code',
        redirectUri: 'https://gather.example/integrations/callback',
      }),
    ).rejects.toThrow()
  })

  test('scopes in an scp array count the same as a scope string', async () => {
    const { t } = await seed()
    const reader = t.withIdentity({
      ...person,
      client_id: 'client_claude',
      scp: ['gather:read'],
    })
    expect(
      await reader.query(api.notes.list, { groupSlug: 'mcp-home' }),
    ).toEqual([])
  })

  test('a grant without a Gather scope cannot even read', async () => {
    const { t } = await seed()
    const other = t.withIdentity(app('openid foundry:read foundry:write'))
    await expect(
      other.query(api.notes.list, { groupSlug: 'mcp-home' }),
    ).rejects.toThrow(CONNECTED_APP_NO_ACCESS)
  })

  test('a write grant writes', async () => {
    const { t } = await seed()
    const writer = t.withIdentity(app('gather:write'))
    await writer.mutation(api.notes.create, {
      groupSlug: 'mcp-home',
      title: 'Wifi',
      body: 'On the router',
      idempotencyKey: KEY,
    })
    expect(
      await writer.query(api.notes.list, { groupSlug: 'mcp-home' }),
    ).toHaveLength(1)
  })

  test('the app session is not a connected app', async () => {
    const { t } = await seed()
    await t.withIdentity(person).mutation(api.notes.create, {
      groupSlug: 'mcp-home',
      title: 'Plain',
      body: 'From the app',
    })
  })

  test('administration stays in the app whatever the grant', async () => {
    const { t, groupId, userId } = await seed()
    const writer = t.withIdentity(app('gather:read gather:write'))
    await expect(writer.mutation(api.accounts.deleteAccount, {})).rejects.toThrow(
      CONNECTED_APP_REFUSED,
    )
    await expect(
      writer.mutation(api.groups.deleteGroup, { groupId }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(
      writer.mutation(api.groups.leaveGroup, { groupId }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(
      writer.mutation(api.groups.setMemberRole, {
        groupId,
        userId,
        role: 'member',
      }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(
      writer.mutation(api.groups.joinByInvite, { inviteCode: 'mcp-home-code' }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    await expect(
      writer.query(api.groups.inviteCode, { slug: 'mcp-home' }),
    ).rejects.toThrow(CONNECTED_APP_REFUSED)
    // Nothing happened.
    const group = await t.run((ctx) => ctx.db.get(groupId))
    expect(group).not.toBeNull()
  })
  test('a connected app lists its Groups without their invite codes', async () => {
    const { t, groupId } = await seed()
    for (const scope of ['gather:read', 'gather:read gather:write']) {
      const groups = await t
        .withIdentity(app(scope))
        .query(api.groups.myGroups, {})
      expect(groups.map((g) => g._id)).toEqual([groupId])
      expect(groups[0]).not.toHaveProperty('inviteCode')
    }
  })
})

describe('idempotent creates', () => {
  test('replaying a key returns the first row and writes nothing', async () => {
    const { t, listId, calendarId } = await seed()
    const writer = t.withIdentity(app('gather:write'))
    const creates = [
      () =>
        writer.mutation(api.notes.create, {
          groupSlug: 'mcp-home',
          title: 'Wifi',
          body: 'x',
          idempotencyKey: `${KEY}-note`,
        }),
      () =>
        writer.mutation(api.tasks.add, {
          groupSlug: 'mcp-home',
          listId,
          title: 'Milk',
          idempotencyKey: `${KEY}-task`,
        }),
      () =>
        writer.mutation(api.taskLists.create, {
          groupSlug: 'mcp-home',
          name: 'Hardware',
          provider: 'local',
          idempotencyKey: `${KEY}-list`,
        }),
      () =>
        writer.mutation(api.recipes.create, {
          groupSlug: 'mcp-home',
          title: 'Soup',
          ingredients: ['water'],
          steps: ['boil'],
          tags: [],
          idempotencyKey: `${KEY}-recipe`,
        }),
      () =>
        writer.mutation(api.calendar.addCalendarEvent, {
          groupSlug: 'mcp-home',
          calendarId,
          title: 'Dentist',
          date: '2026-11-20',
          idempotencyKey: `${KEY}-event`,
        }),
    ]
    for (const create of creates) {
      const first = await create()
      expect(await create()).toBe(first)
    }
    const counts = await t.run(async (ctx) => ({
      notes: (await ctx.db.query('notes').collect()).length,
      tasks: (await ctx.db.query('tasks').collect()).length,
      taskLists: (await ctx.db.query('taskLists').collect()).length,
      recipes: (await ctx.db.query('recipes').collect()).length,
      calendarEvents: (await ctx.db.query('calendarEvents').collect()).length,
    }))
    expect(counts).toEqual({
      notes: 1,
      tasks: 1,
      taskLists: 2,
      recipes: 1,
      calendarEvents: 1,
    })
  })

  test('a connected app must send a key', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(app('gather:write')).mutation(api.notes.create, {
        groupSlug: 'mcp-home',
        title: 'Wifi',
        body: 'x',
      }),
    ).rejects.toThrow(IDEMPOTENCY_KEY_REQUIRED)
  })

  test('a replay after the row was deleted creates it again', async () => {
    const { t } = await seed()
    const writer = t.withIdentity(app('gather:write'))
    const create = () =>
      writer.mutation(api.notes.create, {
        groupSlug: 'mcp-home',
        title: 'Wifi',
        body: 'x',
        idempotencyKey: KEY,
      })
    const first = await create()
    await t.run((ctx) => ctx.db.delete(first))
    const second = await create()
    expect(second).not.toBe(first)
    expect(await create()).toBe(second)
  })

  test('a key reused for another kind of row is refused', async () => {
    const { t, listId } = await seed()
    const writer = t.withIdentity(app('gather:write'))
    await writer.mutation(api.notes.create, {
      groupSlug: 'mcp-home',
      title: 'Wifi',
      body: 'x',
      idempotencyKey: KEY,
    })
    await expect(
      writer.mutation(api.tasks.add, {
        groupSlug: 'mcp-home',
        listId,
        title: 'Milk',
        idempotencyKey: KEY,
      }),
    ).rejects.toThrow(IDEMPOTENCY_KEY_REUSED)
  })

  test('a replay never answers someone who could not have made the write', async () => {
    const { t } = await seed()
    await t.withIdentity(app('gather:write')).mutation(api.notes.create, {
      groupSlug: 'mcp-home',
      title: 'Wifi',
      body: 'x',
      idempotencyKey: KEY,
    })
    const stranger = { subject: 'mcp_eve', name: 'Eve', email: 'e@x.com' }
    await t.run((ctx) =>
      ctx.db.insert('users', {
        clerkId: stranger.subject,
        name: stranger.name,
        email: stranger.email,
      }),
    )
    await expect(
      t.withIdentity(stranger).mutation(api.notes.create, {
        groupSlug: 'mcp-home',
        title: 'Wifi',
        body: 'x',
        idempotencyKey: KEY,
      }),
    ).rejects.toThrow('Not a member of that group')
  })

  test('without a key a create runs every time', async () => {
    const { t } = await seed()
    const writer = t.withIdentity(person)
    for (let i = 0; i < 2; i++)
      await writer.mutation(api.notes.create, {
        groupSlug: 'mcp-home',
        title: 'Wifi',
        body: 'x',
      })
    const notes = await t.run((ctx) => ctx.db.query('notes').collect())
    expect(notes).toHaveLength(2)
  })
})
