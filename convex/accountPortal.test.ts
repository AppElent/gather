import { INVALID_EXPORT_CURSOR } from '@gather/core/refusals'
import { ConvexError } from 'convex/values'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { modules, testConvex } from '../test/convexHarness'
import { insertEnergyHousehold } from '../test/energyFixture'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  COUNT_LIMIT,
  COUNTED,
  type PortalExportPage,
  ROW_BYTES,
} from './accountPortal'
import { CONNECTED_APP_REFUSED } from './lib/connectedApps'
import { PAGE_SIZE } from './lib/dataExport'
import { notSignedInError } from './lib/sharing'
import schema from './schema'

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

type Who = { userId: Id<'users'>; groupId: Id<'groups'> }

/** A Group of the person's beside their first. */
async function addGroup(t: Harness, userId: Id<'users'>, slug: string) {
  return await t.run(async (ctx) => {
    const groupId = await ctx.db.insert('groups', {
      name: slug,
      slug,
      inviteCode: `invite-${slug}`,
    })
    await ctx.db.insert('memberships', { groupId, userId, role: 'admin' })
    return { userId, groupId }
  })
}

/** One row in each House and Finance table, and an Energy household. */
async function fillModules(t: Harness, { userId, groupId }: Who) {
  await t.run(async (ctx) => {
    const by = { groupId, createdByUserId: userId }
    const houseId = await ctx.db.insert('houses', {
      ...by,
      name: 'Home',
      order: 0,
    })
    const calculationId = await ctx.db.insert('mortgageCalculations', {
      ...by,
      houseId,
      updatedByUserId: userId,
      updatedAt: 0,
      name: 'Plan A',
      order: 0,
    })
    await ctx.db.insert('loanParts', {
      groupId,
      calculationId,
      kind: 'annuity',
      principalCents: 1,
      annualRatePercent: 4,
      termMonths: 360,
      order: 0,
    })
    await ctx.db.insert('homeBuyingCosts', {
      groupId,
      houseId,
      updatedByUserId: userId,
      purchasePriceCents: 1,
      ownMoneyCents: 1,
      mortgageCents: 1,
      mortgageRatePercent: 1,
      mortgageTermMonths: 1,
      transferTaxBand: 'ownHome',
      transferTaxPercent: 2,
    })
    await ctx.db.insert('recurringCosts', {
      ...by,
      name: 'Rent',
      amountCents: 1,
      frequency: 'monthly',
      category: 'housing',
      order: 0,
    })
    await ctx.db.insert('savingsGoals', {
      ...by,
      name: 'Holiday',
      targetCents: 1,
      targetDate: '2027-01-01',
      savedCents: 0,
      updatedByUserId: userId,
      updatedAt: 0,
      order: 0,
    })
    await ctx.db.insert('splitScenarios', {
      ...by,
      createdAt: 0,
      name: 'Weekend',
      payments: [],
      participants: [],
      mode: 'equal',
      owed: [],
      transfers: [],
      totalCents: 0,
    })
    const holdingId = await ctx.db.insert('holdings', {
      ...by,
      kind: 'stock',
      symbol: 'ASML',
      name: 'ASML',
      currency: 'EUR',
      openingDate: '2026-01-01',
      openingUnits: 1,
      openingAverageCostCents: 100,
      order: 0,
    })
    await ctx.db.insert('holdingTransactions', {
      ...by,
      holdingId,
      kind: 'buy',
      date: '2026-02-01',
    })
    await ctx.db.insert('financeSettings', { groupId, homeCurrency: 'EUR' })
    await ctx.db.insert('netWorthEntries', {
      ...by,
      kind: 'asset',
      label: 'Car',
      amountCents: 1,
      order: 0,
    })
    await ctx.db.insert('netWorthSnapshots', {
      groupId,
      takenByUserId: userId,
      takenOn: '2026-10-01',
      takenAt: 0,
      rows: [],
      assetsCents: 1,
      liabilitiesCents: 0,
      netCents: 1,
    })
    await insertEnergyHousehold(ctx, groupId, userId)
  })
}

/** `copies` more of every row already in `table`'s first row for the Group. */
async function repeat(
  t: Harness,
  table: 'houses' | 'loanParts' | 'netWorthEntries' | 'energyIntervals',
  groupId: Id<'groups'>,
  copies: number,
) {
  await t.run(async (ctx) => {
    const rows = await ctx.db.query(table).collect()
    const row = rows.find((r) => r.groupId === groupId)
    if (!row) throw new Error(`no ${table} row`)
    const { _id, _creationTime, ...fields } = row
    for (let i = 0; i < copies; i++) {
      await ctx.db.insert(table, fields as never)
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

/** The ConvexError data a refused call carried. */
async function refusalOf(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ConvexError) return error.data
    throw error
  }
  throw new Error('expected a refusal')
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
    await expect(t.query(api.accountPortal.summary, {})).rejects.toMatchObject({
      data: notSignedInError().data,
    })
    await expect(
      t.query(api.accountPortal.deletionBlocker, {}),
    ).rejects.toMatchObject({
      data: notSignedInError().data,
    })
    await expect(
      t.query(api.accountPortal.exportPage, { cursor: null }),
    ).rejects.toMatchObject({
      data: notSignedInError().data,
    })
  })

  test('a connected app is refused', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const agent = t.withIdentity({
      ...asAlice,
      client_id: 'agent',
      scope: 'gather:read',
    })
    for (const call of [
      agent.query(api.accountPortal.summary, {}),
      agent.query(api.accountPortal.deletionBlocker, {}),
      agent.query(api.accountPortal.exportPage, { cursor: null }),
    ]) {
      expect(await refusalOf(call)).toBe(CONNECTED_APP_REFUSED)
    }
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

  test('counts add up across Groups and task lists, and stop at the cap', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    const second = await t.run(async (ctx) => {
      const groupId = await ctx.db.insert('groups', {
        name: 'Allotment',
        slug: 'allotment',
        inviteCode: 'invite-allotment',
      })
      await ctx.db.insert('memberships', {
        groupId,
        userId: alice.userId,
        role: 'admin',
      })
      return { userId: alice.userId, groupId }
    })
    await fill(t, alice, { notes: 600, recipes: 1, tasks: 3 }, 'A')
    await fill(t, alice, { notes: 0, recipes: 0, tasks: 4 }, 'A2')
    await fill(t, second, { notes: 401, recipes: 2, tasks: 5 }, 'B')

    const summary = await t
      .withIdentity(asAlice)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    expect(countOf(summary, 'groups')).toMatchObject({ count: 2 })
    expect(countOf(summary, 'recipes')).toMatchObject({ count: 3, more: false })
    expect(countOf(summary, 'taskLists')).toMatchObject({ count: 3 })
    expect(countOf(summary, 'tasks')).toMatchObject({ count: 12, more: false })
    expect(countOf(summary, 'notes')).toEqual({
      key: 'notes',
      count: COUNT_LIMIT,
      more: true,
    })

    const { tables } = await drain(t, asAlice)
    expect(tables['groups/allotment/tasks']).toHaveLength(5)
    expect(tables[`groups/${alice.slug}/tasks`]).toHaveLength(7)
    expect(tables['groups/allotment/notes']).toHaveLength(401)
  })

  test('a cursor that is not one, or names a Group of somebody else, is refused', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const bob = await signUp(t, asBob)
    const as = t.withIdentity(asAlice)
    expect(
      await refusalOf(as.query(api.accountPortal.exportPage, { cursor: 'nope' })),
    ).toEqual(INVALID_EXPORT_CURSOR)
    const unknownStep = JSON.stringify({
      groups: [],
      table: 'seedRuns',
      group: null,
      page: null,
    })
    expect(
      await refusalOf(
        as.query(api.accountPortal.exportPage, { cursor: unknownStep }),
      ),
    ).toEqual(INVALID_EXPORT_CURSOR)
    const forged = JSON.stringify({
      groups: [{ id: bob.groupId, slug: bob.slug }],
      table: 'notes',
      group: 0,
      page: null,
    })
    expect(
      await refusalOf(as.query(api.accountPortal.exportPage, { cursor: forged })),
    ).toMatchObject({ kind: expect.stringMatching(/member/i) })
    const badChild = JSON.stringify({
      groups: [{ id: bob.groupId, slug: bob.slug }],
      table: 'tasks',
      group: 0,
      page: 'not json',
    })
    expect(
      await refusalOf(
        t
          .withIdentity(asBob)
          .query(api.accountPortal.exportPage, { cursor: badChild }),
      ),
    ).toEqual(INVALID_EXPORT_CURSOR)
  })

  test('a Group renamed mid-export, and another given its old slug, cannot swap in', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    await fill(t, alice, { notes: PAGE_SIZE + 1, recipes: 0, tasks: 0 }, 'Own')
    const as = t.withIdentity(asAlice)
    // Walk to the middle of the notes.
    let cursor: string | null = null
    for (;;) {
      const page: PortalExportPage = await as.query(
        api.accountPortal.exportPage,
        { cursor },
      )
      cursor = page.next
      if (page.tables[`groups/${alice.slug}/notes`]?.length) break
    }
    // Rename it, and let a new Group of Alice's take the old slug.
    await t.run(async (ctx) => {
      await ctx.db.patch(alice.groupId, { slug: 'renamed' })
      const impostor = await ctx.db.insert('groups', {
        name: 'Impostor',
        slug: alice.slug,
        inviteCode: 'invite-impostor',
      })
      await ctx.db.insert('memberships', {
        groupId: impostor,
        userId: alice.userId,
        role: 'admin',
      })
      await ctx.db.insert('notes', {
        groupId: impostor,
        title: 'Impostor note',
        body: '',
        createdBy: alice.userId,
        updatedAt: 0,
      })
    })
    const rest: unknown[] = []
    while (cursor !== null) {
      const page: PortalExportPage = await as.query(
        api.accountPortal.exportPage,
        { cursor },
      )
      for (const rows of Object.values(page.tables)) rest.push(...rows)
      cursor = page.next
    }
    const text = JSON.stringify(rest)
    expect(text).toContain(`Own note ${PAGE_SIZE}`)
    expect(text).not.toContain('Impostor')
  })
})

describe('House, Finance and Energy', () => {
  const MODULE_KEYS = ['houseRecords', 'financeRecords', 'energyRecords']

  async function summaryOf(t: Harness, identity: typeof asAlice) {
    const summary = await t
      .withIdentity(identity)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    return summary
  }

  test('each is one key, last, counting all its tables', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    await fillModules(t, alice)
    const energy = await t.run(async (ctx) => {
      const tables = COUNTED.find((c) => c.key === 'energyRecords')?.tables
      let rows = 0
      for (const table of tables ?? []) {
        const found = (await ctx.db.query(table).collect()).length
        expect(found, table).toBeGreaterThan(0)
        rows += found
      }
      return rows
    })

    const summary = await summaryOf(t, asAlice)
    expect(summary.counts.slice(-3)).toEqual([
      { key: 'houseRecords', count: 4, more: false },
      { key: 'financeRecords', count: 8, more: false },
      { key: 'energyRecords', count: energy, more: false },
    ])
    expect(summary.counts.map((c) => c.key)).toEqual([
      'groups',
      'recipes',
      'meals',
      'plannedMeals',
      'taskLists',
      'tasks',
      'notes',
      'calendarEvents',
      'babyEvents',
      'tastings',
      'loyaltyCards',
      ...MODULE_KEYS,
    ])
  })

  test('a key over several tables and Groups shares one cap', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    const second = await addGroup(t, alice.userId, 'allotment')
    await fillModules(t, alice)
    await fillModules(t, second)
    // House: 8 rows so far. 992 more is exactly the cap, over two tables.
    await repeat(t, 'houses', alice.groupId, 500)
    await repeat(t, 'loanParts', second.groupId, 492)
    expect(countOf(await summaryOf(t, asAlice), 'houseRecords')).toEqual({
      key: 'houseRecords',
      count: COUNT_LIMIT,
      more: false,
    })

    await repeat(t, 'loanParts', second.groupId, 1)
    const summary = await summaryOf(t, asAlice)
    expect(countOf(summary, 'houseRecords')).toEqual({
      key: 'houseRecords',
      count: COUNT_LIMIT,
      more: true,
    })
    // The cap is per key.
    expect(countOf(summary, 'financeRecords')).toEqual({
      key: 'financeRecords',
      count: 16,
      more: false,
    })
  })

  test('a caller without them gets zeros', async () => {
    const t = testConvex()
    await signUp(t, asAlice)
    const summary = await summaryOf(t, asAlice)
    expect(summary.counts.slice(-3)).toEqual(
      MODULE_KEYS.map((key) => ({ key, count: 0, more: false })),
    )
  })

  test('a second account sees none of the first’s rows', async () => {
    const t = testConvex()
    const alice = await signUp(t, asAlice)
    await signUp(t, asBob)
    await fillModules(t, alice)
    const summary = await summaryOf(t, asBob)
    for (const key of MODULE_KEYS) {
      expect(countOf(summary, key)).toEqual({ key, count: 0, more: false })
    }
  })
})

describe('the read limits of one query', () => {
  const DOCUMENTS = 32_000
  const RANGES = 4096
  const BYTES = 16 * 1024 * 1024

  /** A Convex that refuses a query past its read limits, as production does. */
  function limited(): Harness {
    return convexTest({ schema, modules, transactionLimits: true })
  }

  /** Rows seeded a batch per transaction, inside the write limits. */
  async function seedIn(
    rows: number,
    batch: (from: number, to: number) => Promise<unknown>,
  ) {
    for (let from = 0; from < rows; from += 500) {
      await batch(from, Math.min(rows, from + 500))
    }
  }

  test('the arithmetic on `readGuard`', () => {
    const most = COUNT_LIMIT + 1
    const documents = 1 + most + most + COUNTED.length * most
    expect(documents).toBe(15_016)
    expect(documents).toBeLessThan(DOCUMENTS)
    expect(DOCUMENTS - documents).toBe(16_984)

    const tables = COUNTED.flatMap((c) => c.tables as readonly string[])
    expect(tables).toHaveLength(30)
    // Counted tables without a `groupId` are read under a parent.
    const parents = tables.filter(
      (name) =>
        !('groupId' in schema.tables[name as keyof typeof schema.tables].validator.fields),
    ).length
    expect(parents).toBe(3)
    const perGroup = 1 + tables.length + parents
    expect(perGroup).toBe(34)
    expect(2 + perGroup * 120).toBeLessThanOrEqual(RANGES)
    expect(2 + perGroup * 121).toBeGreaterThan(RANGES)

    // Capped keys fit at 1 KiB a row, and a row is let in only with room for
    // the largest document.
    expect(COUNTED.length * most * 1024).toBeLessThan(BYTES)
    expect(ROW_BYTES).toBeGreaterThan(1024 * 1024)
  })

  test('every key capped fits', { timeout: 60_000 }, async () => {
    const t = limited()
    const alice = await signUp(t, asAlice)
    await fillModules(t, alice)
    const over = COUNT_LIMIT + 1
    const { userId, groupId } = alice
    const ids = await t.run(async (ctx) => ({
      listId: await ctx.db.insert('taskLists', {
        groupId,
        name: 'L',
        provider: 'local',
        order: 0,
      }),
      calendarId: await ctx.db.insert('calendars', {
        groupId,
        name: 'C',
        source: 'local',
        createdBy: userId,
      }),
      babyId: await ctx.db.insert('babies', {
        groupId,
        name: 'Noor',
        birthDate: '2026-01-01',
        order: 0,
      }),
      subjectId: await ctx.db.insert('tastingSubjects', {
        groupId,
        kind: 'cheese',
        name: 'Comté',
        attributes: {},
        createdByUserId: userId,
      }),
    }))
    await seedIn(over, (from, to) =>
      t.run(async (ctx) => {
        for (let i = from; i < to; i++) {
          const at = { groupId, name: `${i}`, title: `${i}` }
          await ctx.db.insert('recipes', {
            groupId,
            sharedGroupIds: [],
            createdByUserId: userId,
            title: at.title,
            ingredients: [],
            steps: [],
            tags: [],
          })
          await ctx.db.insert('mealEntries', {
            groupId,
            title: at.title,
            createdBy: userId,
          })
          await ctx.db.insert('plannedDinners', {
            groupId,
            date: '2026-10-19',
            title: at.title,
          })
          await ctx.db.insert('taskLists', {
            groupId,
            name: at.name,
            provider: 'local',
            order: i,
          })
          await ctx.db.insert('tasks', {
            listId: ids.listId,
            title: at.title,
            done: false,
            order: i,
            createdBy: userId,
          })
          await ctx.db.insert('notes', {
            groupId,
            title: at.title,
            body: '',
            createdBy: userId,
            updatedAt: 0,
          })
          await ctx.db.insert('calendarEvents', {
            calendarId: ids.calendarId,
            title: at.title,
            date: '2026-10-21',
            createdBy: userId,
          })
          await ctx.db.insert('babyEvents', {
            babyId: ids.babyId,
            type: 'memory',
            timestamp: 0,
            loggedBy: userId,
            data: { what: at.title },
          })
          await ctx.db.insert('tastings', {
            subjectId: ids.subjectId,
            groupId,
            rating: 4,
            tastedAt: '2026-10-01',
            attributes: {},
            createdByUserId: userId,
          })
          await ctx.db.insert('loyaltyCards', {
            groupId,
            createdByUserId: userId,
            storeName: at.name,
            cardNumber: at.name,
            barcodeFormat: 'EAN_13',
          })
        }
      }),
    )
    await seedIn(over, async (from, to) => {
      await repeat(t, 'houses', groupId, to - from)
      await repeat(t, 'netWorthEntries', groupId, to - from)
      await repeat(t, 'energyIntervals', groupId, to - from)
    })
    const summary = await t
      .withIdentity(asAlice)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    for (const { key } of COUNTED) {
      expect(countOf(summary, key)).toEqual({
        key,
        count: COUNT_LIMIT,
        more: true,
      })
    }
  })

  test('more Groups than index ranges says more, and never throws', { timeout: 60_000 }, async () => {
    const t = limited()
    const alice = await signUp(t, asAlice)
    await seedIn(COUNT_LIMIT, (from, to) =>
      t.run(async (ctx) => {
        for (let i = from; i < to; i++) {
          const groupId = await ctx.db.insert('groups', {
            name: `G${i}`,
            slug: `g${i}`,
            inviteCode: `i${i}`,
          })
          await ctx.db.insert('memberships', {
            groupId,
            userId: alice.userId,
            role: 'admin',
          })
        }
      }),
    )
    const summary = await t
      .withIdentity(asAlice)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    expect(countOf(summary, 'groups')).toEqual({
      key: 'groups',
      count: COUNT_LIMIT,
      more: true,
    })
    // Read to the end before the ranges ran out: exact.
    expect(countOf(summary, 'recipes')).toMatchObject({ count: 0, more: false })
    // Not read to the end: never a bare zero.
    for (const key of ['houseRecords', 'financeRecords', 'energyRecords']) {
      expect(countOf(summary, key)).toEqual({ key, count: 0, more: true })
    }
  })

  /** Seventeen rows of nearly 1 MiB: more than one query may read. */
  const LARGE = 'x'.repeat(1000 * 1024)

  test.each(['notes', 'houses', 'netWorthSnapshots'] as const)(
    'large %s stop the count with more, and never throw',
    { timeout: 60_000 },
    async (table) => {
      const t = limited()
      const alice = await signUp(t, asAlice)
      const { groupId, userId } = alice
      for (let i = 0; i < 17; i++) {
        await t.run(async (ctx) => {
          if (table === 'notes') {
            await ctx.db.insert('notes', {
              groupId,
              title: 'Long',
              body: LARGE,
              createdBy: userId,
              updatedAt: 0,
            })
          } else if (table === 'houses') {
            await ctx.db.insert('houses', {
              groupId,
              createdByUserId: userId,
              name: LARGE,
              order: i,
            })
          } else {
            await ctx.db.insert('netWorthSnapshots', {
              groupId,
              takenByUserId: userId,
              takenOn: '2026-10-01',
              takenAt: 0,
              rows: [
                { kind: 'asset', source: 'manual', label: LARGE, amountCents: 1 },
              ],
              assetsCents: 1,
              liabilitiesCents: 0,
              netCents: 1,
            })
          }
        })
      }
      const summary = await t
        .withIdentity(asAlice)
        .query(api.accountPortal.summary, {})
      if (!summary) throw new Error('no summary')
      const key = {
        notes: 'notes',
        houses: 'houseRecords',
        netWorthSnapshots: 'financeRecords',
      }[table]
      const found = countOf(summary, key)
      expect(found).toMatchObject({ more: true })
      expect(found?.count).toBeGreaterThan(10)
      expect(found?.count).toBeLessThan(17)
      // The keys before it are exact.
      expect(countOf(summary, 'recipes')).toMatchObject({ more: false })
    },
  )

  test('more parents than documents says more, and never throws', { timeout: 60_000 }, async () => {
    const t = limited()
    const alice = await signUp(t, asAlice)
    await seedIn(32_001, (from, to) =>
      t.run(async (ctx) => {
        for (let i = from; i < to; i++) {
          await ctx.db.insert('taskLists', {
            groupId: alice.groupId,
            name: 'L',
            provider: 'local',
            order: i,
          })
        }
      }),
    )
    const summary = await t
      .withIdentity(asAlice)
      .query(api.accountPortal.summary, {})
    if (!summary) throw new Error('no summary')
    expect(countOf(summary, 'taskLists')).toEqual({
      key: 'taskLists',
      count: COUNT_LIMIT,
      more: true,
    })
    expect(countOf(summary, 'tasks')).toMatchObject({ count: 0, more: true })
    expect(countOf(summary, 'energyRecords')).toMatchObject({ more: true })
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
