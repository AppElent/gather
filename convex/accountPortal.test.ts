import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { COUNT_LIMIT, type PortalExportPage } from './accountPortal'
import { PAGE_SIZE } from './lib/dataExport'

/**
 * The account portal contract (standards/account-portal.md): what
 * account.appelent.nl reads, for somebody who never used Gather, somebody who
 * did, somebody whose deletion is running, and somebody else entirely.
 */

type Harness = ReturnType<typeof testConvex>

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@x.test' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@x.test' }
const asDora = { subject: 'clerk_dora', name: 'Dora', email: 'd@x.test' }

async function signUp(t: Harness, identity: typeof asAlice) {
  await t.withIdentity(identity).mutation(api.users.ensureUser, {})
  return await t.run(async (ctx) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()
    if (!user) throw new Error('no user row')
    const slug = `${identity.name.toLowerCase()}-home`
    const groupId = await ctx.db.insert('groups', {
      name: `${identity.name} home`,
      slug,
      inviteCode: `invite-${slug}`,
    })
    await ctx.db.insert('memberships', {
      groupId,
      userId: user._id,
      role: 'admin',
    })
    return { userId: user._id, groupId, slug }
  })
}

/** Notes, recipes and one list of tasks in the person's first Group. */
async function fill(
  t: Harness,
  who: { userId: Id<'users'>; groupId: Id<'groups'> },
  sizes: { notes: number; recipes: number; tasks: number },
  label: string,
) {
  await t.run(async (ctx) => {
    for (let i = 0; i < sizes.notes; i++) {
      await ctx.db.insert('notes', {
        groupId: who.groupId,
        title: `${label} note ${i}`,
        body: '',
        createdBy: who.userId,
        updatedAt: 0,
      })
    }
    for (let i = 0; i < sizes.recipes; i++) {
      await ctx.db.insert('recipes', {
        groupId: who.groupId,
        sharedGroupIds: [],
        createdByUserId: who.userId,
        title: `${label} recipe ${i}`,
        ingredients: [],
        steps: [],
        tags: [],
      })
    }
    const listId = await ctx.db.insert('taskLists', {
      groupId: who.groupId,
      name: `${label} list`,
      provider: 'local',
      order: 0,
    })
    for (let i = 0; i < sizes.tasks; i++) {
      await ctx.db.insert('tasks', {
        listId,
        title: `${label} task ${i}`,
        done: false,
        order: i,
        createdBy: who.userId,
      })
    }
  })
}

/** Every page until `next` is null, merged by key. */
async function drain(t: Harness, identity: typeof asAlice) {
  const as = t.withIdentity(identity)
  const tables: Record<string, unknown[]> = {}
  let cursor: string | null = null
  let pages = 0
  do {
    const page: PortalExportPage = await as.query(
      api.accountPortal.exportPage,
      { cursor },
    )
    expect(page.contract).toBe(1)
    expect(page.app).toBe('gather')
    for (const [key, rows] of Object.entries(page.tables)) {
      tables[key] = [...(tables[key] ?? []), ...rows]
    }
    cursor = page.next
    pages++
    if (pages > 5000) throw new Error('export did not end')
  } while (cursor !== null)
  return { tables, pages }
}

function countOf(
  summary: { counts: { key: string; count: number; more: boolean }[] },
  key: string,
) {
  return summary.counts.find((c) => c.key === key)
}

describe('a caller who never used Gather', () => {
  test('gets null, no blocker and an empty export, and no row is made', async () => {
    const t = testConvex()
    const as = t.withIdentity(asDora)

    expect(await as.query(api.accountPortal.summary, {})).toBeNull()
    expect(await as.query(api.accountPortal.deletionBlocker, {})).toBeNull()
    expect(
      await as.query(api.accountPortal.exportPage, { cursor: null }),
    ).toEqual({ contract: 1, app: 'gather', tables: {}, next: null })

    const users = await t.run((ctx) => ctx.db.query('users').collect())
    expect(users).toEqual([])
  })

  test('without a token is refused, not shown as never used', async () => {
    const t = testConvex()
    await expect(t.query(api.accountPortal.summary, {})).rejects.toThrow()
    await expect(
      t.query(api.accountPortal.exportPage, { cursor: null }),
    ).rejects.toThrow()
  })

  test('a connected app is refused', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const agent = t.withIdentity({
      ...asAlice,
      client_id: 'agent',
      scope: 'gather:read',
    })
    await expect(agent.query(api.accountPortal.summary, {})).rejects.toThrow()
    await expect(
      agent.query(api.accountPortal.exportPage, { cursor: null }),
    ).rejects.toThrow()
  })
})

describe('a caller with data', () => {
  test('summary counts per kind, capped at 1,000 reads with more', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    await fill(t, alice, { notes: COUNT_LIMIT + 1, recipes: 3, tasks: 7 }, 'A')

    const summary = await t
      .withIdentity(asAlice)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    expect(summary.contract).toBe(1)
    expect(summary.lastActiveAt).toBeNull()
    expect(countOf(summary, 'groups')).toEqual({
      key: 'groups',
      count: 1,
      more: false,
    })
    expect(countOf(summary, 'notes')).toEqual({
      key: 'notes',
      count: COUNT_LIMIT,
      more: true,
    })
    expect(countOf(summary, 'recipes')).toMatchObject({ count: 3, more: false })
    expect(countOf(summary, 'taskLists')).toMatchObject({ count: 1 })
    expect(countOf(summary, 'tasks')).toMatchObject({ count: 7, more: false })
    expect(countOf(summary, 'calendarEvents')).toMatchObject({ count: 0 })
    // Stable camelCase keys, each once.
    const keys = summary.counts.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z][a-zA-Z]*$/)
  })

  test('the export drains across pages to next: null with every row', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    const tasks = PAGE_SIZE + 5
    await fill(t, alice, { notes: PAGE_SIZE * 2 + 1, recipes: 2, tasks }, 'A')

    const { tables, pages } = await drain(t, asAlice)
    const prefix = `groups/${alice.slug}`
    expect(tables.export).toHaveLength(1)
    expect(tables.export?.[0]).toMatchObject({
      format: 'gather.data-export',
      groups: [{ slug: alice.slug }],
    })
    expect(tables.users).toHaveLength(1)
    expect(tables[`${prefix}/groups`]).toHaveLength(1)
    expect(tables[`${prefix}/notes`]).toHaveLength(PAGE_SIZE * 2 + 1)
    expect(tables[`${prefix}/recipes`]).toHaveLength(2)
    expect(tables[`${prefix}/tasks`]).toHaveLength(tasks)
    expect(pages).toBeGreaterThan(4)

    // The in-app content rules: no Clerk subject, no invite code, and
    // people by name.
    const text = JSON.stringify(tables)
    expect(text).not.toContain(asAlice.subject)
    expect(text).not.toContain(`invite-${alice.slug}`)
    expect(tables[`${prefix}/notes`]?.[0]).toMatchObject({ createdBy: 'Alice' })
  })

  test('a cursor that is not one, or names a Group of somebody else, is refused', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const bob = await signUp(t, asBob)
    const as = t.withIdentity(asAlice)
    await expect(
      as.query(api.accountPortal.exportPage, { cursor: 'nope' }),
    ).rejects.toThrow()
    const forged = JSON.stringify({
      groups: [bob.slug],
      table: 'notes',
      group: bob.slug,
      page: null,
    })
    await expect(
      as.query(api.accountPortal.exportPage, { cursor: forged }),
    ).rejects.toThrow()
  })
})

describe('a caller whose deletion is running', () => {
  test('is blocked, and reads as gone', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    await fill(t, alice, { notes: 2, recipes: 0, tasks: 0 }, 'A')
    const as = t.withIdentity(asAlice)
    await as.mutation(api.accounts.deleteAccount, {
      expectedSubject: asAlice.subject,
    })

    expect(await as.query(api.accountPortal.deletionBlocker, {})).toEqual({
      code: 'deletionInProgress',
      params: {},
    })
    expect(await as.query(api.accountPortal.summary, {})).toBeNull()
    expect(
      await as.query(api.accountPortal.exportPage, { cursor: null }),
    ).toEqual({ contract: 1, app: 'gather', tables: {}, next: null })
  })
})

describe('a second account', () => {
  test('sees none of the first account’s rows', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    const bob = await signUp(t, asBob)
    await fill(t, alice, { notes: 3, recipes: 2, tasks: 4 }, 'Alice')
    await fill(t, bob, { notes: 1, recipes: 0, tasks: 0 }, 'Bob')

    const summary = await t
      .withIdentity(asBob)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    expect(countOf(summary, 'notes')).toMatchObject({ count: 1 })
    expect(countOf(summary, 'recipes')).toMatchObject({ count: 0 })
    expect(countOf(summary, 'tasks')).toMatchObject({ count: 0 })
    expect(await t.withIdentity(asBob).query(api.accountPortal.deletionBlocker, {})).toBeNull()

    const { tables } = await drain(t, asBob)
    const text = JSON.stringify(tables)
    expect(text).toContain('Bob note 0')
    expect(text).not.toContain('Alice')
    expect(text).not.toContain(alice.slug)
    expect(text).not.toContain(alice.groupId)
  })
})
