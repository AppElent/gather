import { DAY_MS } from '@gather/core/groceries'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { CHECKED_GROCERIES_KEPT } from './groceryPrune'
import { GROCERY_HISTORY_WINDOW } from './lib/groceryCategories'
import { GROCERY_HABITS_WINDOW, RECENT_GROCERIES_WINDOW } from './tasks'

/**
 * The daily prune of checked grocery items (APP-404), through the real
 * functions: each grocery list keeps what Recent, the habits and recognition
 * read, so they answer the same after it; open items, other lists and small
 * lists keep every row.
 */

const SLUG = 'jansen'
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const groupId = await seedGroup(ctx, { name: SLUG, slug: SLUG })
    await seedMember(ctx, groupId, userId, 'admin')
    const groceries = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Boodschappen',
      provider: 'local',
      order: 0,
    })
    const market = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Markt',
      provider: 'local',
      order: 1,
      kind: 'groceries',
    })
    const chores = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Klusjes',
      provider: 'local',
      order: 2,
    })
    await ctx.db.patch(groupId, { groceryListId: groceries })
    return { userId, groupId, groceries, market, chores }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

/**
 * One of 120 names, so names repeat and the habits have counts and
 * intervals. Letters only: digits would read as an amount.
 */
const name = (i: number) => {
  const n = i % 120
  return `zz${String.fromCharCode(97 + Math.floor(n / 26))}${String.fromCharCode(97 + (n % 26))}k`
}

/**
 * Rows on a list, in insertion order: `legacy` checked before `doneAt`
 * existed, then `stamped` checked one hour apart up to now, then `open`.
 */
async function fill(
  { t, userId }: Seeded,
  listId: Id<'taskLists'>,
  counts: { legacy?: number; stamped?: number; open?: number },
) {
  const now = Date.now()
  const stamped = counts.stamped ?? 0
  await t.run(async (ctx) => {
    const row = (i: number) => ({
      listId,
      title: name(i),
      createdBy: userId,
      order: i,
    })
    for (let i = 0; i < (counts.legacy ?? 0); i++)
      await ctx.db.insert('tasks', { ...row(i), done: true })
    for (let i = 0; i < stamped; i++)
      await ctx.db.insert('tasks', {
        ...row(i),
        done: true,
        doneAt: now - (stamped - i) * HOUR,
      })
    for (let i = 0; i < (counts.open ?? 0); i++)
      await ctx.db.insert('tasks', { ...row(i + 7), done: false })
  })
}

/** `title` checked on `listId` this long ago, once per entry. */
async function checked(
  { t, userId }: Seeded,
  listId: Id<'taskLists'>,
  title: string,
  agoMs: number[],
) {
  const now = Date.now()
  await t.run(async (ctx) => {
    for (const ago of agoMs)
      await ctx.db.insert('tasks', {
        listId,
        title,
        done: true,
        doneAt: now - ago,
        createdBy: userId,
        order: 0,
      })
  })
}

async function rows({ t }: Seeded, listId: Id<'taskLists'>) {
  const all = await t.run((ctx) =>
    ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', listId))
      .collect(),
  )
  return {
    all,
    open: all.filter((row) => !row.done).length,
    stamped: all.filter((row) => row.done && row.doneAt !== undefined).length,
    legacy: all.filter((row) => row.done && row.doneAt === undefined).length,
  }
}

/** What the Group's readers of checked items answer now. */
async function readers(s: Seeded) {
  return {
    recent: await s.as.query(api.tasks.recentGroceries, { groupSlug: SLUG }),
    habits: await s.as.query(api.tasks.groceryHabits, {
      groupSlug: SLUG,
      listId: s.groceries,
    }),
    marketHabits: await s.as.query(api.tasks.groceryHabits, {
      groupSlug: SLUG,
      listId: s.market,
    }),
  }
}

async function prune({ t }: Seeded, dryRun?: boolean) {
  await t.mutation(internal.groceryPrune.pruneCheckedGroceries, { dryRun })
  await t.finishAllScheduledFunctions(vi.runAllTimers)
}

describe('the kept count', () => {
  test('covers what Recent and the habits read, with a margin', () => {
    expect(CHECKED_GROCERIES_KEPT).toBeGreaterThan(GROCERY_HABITS_WINDOW)
    expect(CHECKED_GROCERIES_KEPT).toBeGreaterThan(RECENT_GROCERIES_WINDOW)
    expect(CHECKED_GROCERIES_KEPT).toBeGreaterThanOrEqual(
      GROCERY_HISTORY_WINDOW,
    )
  })
})

// These tests seed hundreds of rows through convex-test, which takes about
// 1 s on an idle Mac and over 6 s on a busy one, past Vitest's 5 s default
// (APP-535). 30 s matches the screen tests in Foundry (APP-530).
describe('pruning checked groceries', { timeout: 30_000 }, () => {
  test('keeps the newest per grocery list and leaves Recent and the habits as they were', async () => {
    const s = await seed()
    const over = 300
    await fill(s, s.groceries, {
      legacy: CHECKED_GROCERIES_KEPT + 50,
      stamped: CHECKED_GROCERIES_KEPT + over,
      open: 40,
    })
    await fill(s, s.market, { stamped: 30, open: 3 })
    await fill(s, s.chores, { stamped: CHECKED_GROCERIES_KEPT + 100 })
    // Bought every ten days and due again: a suggestion.
    await checked(s, s.groceries, 'melk', [30, 20, 10].map((d) => d * DAY_MS))
    const groceriesBefore = await rows(s, s.groceries)
    const before = await readers(s)
    expect(before.recent.length).toBeGreaterThan(0)
    expect(before.habits.suggestions.length).toBeGreaterThan(0)

    await prune(s)

    const after = await rows(s, s.groceries)
    expect(after.stamped).toBe(CHECKED_GROCERIES_KEPT)
    expect(after.legacy).toBe(CHECKED_GROCERIES_KEPT)
    expect(after.open).toBe(40)
    // The newest checks stayed, the oldest went.
    const newest = (list: typeof after.all) =>
      list
        .filter((row) => row.doneAt !== undefined)
        .map((row) => row.doneAt ?? 0)
        .sort((a, b) => b - a)
        .slice(0, CHECKED_GROCERIES_KEPT)
    expect(newest(after.all)).toEqual(newest(groceriesBefore.all))
    expect(await readers(s)).toEqual(before)

    // Other lists and a grocery list under the count keep every row.
    expect((await rows(s, s.chores)).stamped).toBe(CHECKED_GROCERIES_KEPT + 100)
    expect(await rows(s, s.market)).toMatchObject({ stamped: 30, open: 3 })

    // A second run finds nothing more to delete.
    await prune(s)
    expect((await rows(s, s.groceries)).all.length).toBe(after.all.length)
    expect(await readers(s)).toEqual(before)
  })

  test('after the doneAt backfill it deletes only the oldest backfilled items, which nothing reads (APP-445)', async () => {
    const s = await seed()
    await fill(s, s.groceries, {
      legacy: CHECKED_GROCERIES_KEPT + 50,
      stamped: 30,
      open: 5,
    })
    const stampedBefore = (await rows(s, s.groceries)).all
      .filter((row) => row.doneAt !== undefined)
      .map((row) => row._id)
    let cursor: string | null = null
    do {
      const page: { more: boolean; cursor: string } = await s.t.mutation(
        internal.maintenance.backfillDoneAt,
        { apply: true, cursor },
      )
      cursor = page.more ? page.cursor : null
    } while (cursor)
    const before = await readers(s)

    await prune(s)

    const after = await rows(s, s.groceries)
    expect(after.all.length).toBeLessThan(CHECKED_GROCERIES_KEPT + 85)
    expect(after.stamped).toBeGreaterThanOrEqual(CHECKED_GROCERIES_KEPT)
    expect(after.open).toBe(5)
    const kept = new Set(after.all.map((row) => row._id))
    expect(stampedBefore.every((id) => kept.has(id))).toBe(true)
    expect(await readers(s)).toEqual(before)
  })

  test('a dry run deletes nothing', async () => {
    const s = await seed()
    await fill(s, s.groceries, { stamped: CHECKED_GROCERIES_KEPT + 20 })
    await prune(s, true)
    expect((await rows(s, s.groceries)).stamped).toBe(
      CHECKED_GROCERIES_KEPT + 20,
    )
  })

  test('keeps what recognition reads: the newest rows by when they were added', async () => {
    const s = await seed()
    await fill(s, s.groceries, { stamped: CHECKED_GROCERIES_KEPT + 10 })
    // Added last, checked long ago: below the kept count by its check, but
    // among the newest rows recognition reads.
    const late = await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.groceries,
        title: 'zzlatek',
        done: true,
        doneAt: Date.now() - 10_000 * DAY_MS,
        createdBy: s.userId,
        order: 0,
      }),
    )
    await prune(s)
    expect(await s.t.run((ctx) => ctx.db.get(late))).not.toBeNull()
    expect((await rows(s, s.groceries)).stamped).toBe(CHECKED_GROCERIES_KEPT + 1)
  })

  test('a pruned item takes its completion rows with it', async () => {
    const s = await seed()
    await fill(s, s.groceries, { stamped: CHECKED_GROCERIES_KEPT + 1 })
    const oldest = (await rows(s, s.groceries)).all.reduce((a, b) =>
      (a.doneAt ?? 0) < (b.doneAt ?? 0) ? a : b,
    )
    await s.t.run((ctx) =>
      ctx.db.insert('taskCompletions', {
        groupId: s.groupId,
        taskId: oldest._id,
        completedBy: s.userId,
        completedAt: 0,
        completedOn: '2026-01-01',
        nextDueDate: '2026-01-08',
      }),
    )
    await prune(s)
    expect(await s.t.run((ctx) => ctx.db.get(oldest._id))).toBeNull()
    const completions = await s.t.run((ctx) =>
      ctx.db.query('taskCompletions').collect(),
    )
    expect(completions).toEqual([])
  })

  test('the undo of a Clear checked still brings back what it cleared', async () => {
    const s = await seed()
    await fill(s, s.groceries, { stamped: CHECKED_GROCERIES_KEPT + 50 })
    const clear = () =>
      s.as.mutation(api.taskLists.clearCheckedUndoable, {
        groupSlug: SLUG,
        listId: s.groceries,
      })
    await clear()
    vi.advanceTimersByTime(HOUR)
    // Checked since that clear: the Checked section a second clear empties.
    await checked(s, s.groceries, 'melk', Array(20).fill(0))
    vi.advanceTimersByTime(HOUR)
    const { clearedAt, previous } = await clear()
    await prune(s)
    await s.as.mutation(api.taskLists.restoreCheckedCleared, {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: previous,
      clearedAt,
    })
    const list = await s.t.run((ctx) => ctx.db.get(s.groceries))
    expect(list?.checkedClearedAt).toBe(previous)
    const back = (await rows(s, s.groceries)).all.filter(
      (row) => row.done && (row.doneAt ?? 0) > (previous ?? 0),
    )
    expect(back).toHaveLength(20)
  })

  test('keeps subtasks and their parents, from a list that became a grocery list', async () => {
    const s = await seed()
    // Oldest of all, by check and by when they were added: only the subtask
    // tree keeps them.
    const long = Date.now() - 100_000 * HOUR
    const old = (title: string, extra: object = {}) =>
      s.t.run((ctx) =>
        ctx.db.insert('tasks', {
          listId: s.groceries,
          title,
          done: true,
          doneAt: long,
          createdBy: s.userId,
          order: 0,
          ...extra,
        }),
      )
    const parent = await old('zzparentk')
    const checkedChild = await old('zzchildk', { parentTaskId: parent })
    const openChild = await old('zzopenk', {
      parentTaskId: parent,
      done: false,
      doneAt: undefined,
    })
    const plain = await old('zzplaink')
    await fill(s, s.groceries, { stamped: CHECKED_GROCERIES_KEPT + 10 })

    await prune(s)

    const get = (id: Id<'tasks'>) => s.t.run((ctx) => ctx.db.get(id))
    expect(await get(plain)).toBeNull()
    expect(await get(parent)).not.toBeNull()
    expect(await get(checkedChild)).toMatchObject({ parentTaskId: parent })
    expect(await get(openChild)).toMatchObject({ parentTaskId: parent })
    expect((await rows(s, s.groceries)).stamped).toBe(
      CHECKED_GROCERIES_KEPT + 2,
    )
  })

  test('stops for a list that is no grocery list any more', async () => {
    const s = await seed()
    await fill(s, s.market, { stamped: CHECKED_GROCERIES_KEPT + 10 })
    await s.t.mutation(internal.groceryPrune.pruneCheckedGroceries, {})
    await s.t.run((ctx) => ctx.db.patch(s.market, { kind: undefined }))
    await s.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await rows(s, s.market)).stamped).toBe(CHECKED_GROCERIES_KEPT + 10)
  })
})
