import type { TaskRefusalCode } from '@gather/core/refusals'
import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { GROCERY_HISTORY_WINDOW } from './lib/groceryCategories'
import { RECENT_GROCERIES_LIMIT } from './tasks'

/**
 * A grocery list's Recent and Clear checked (APP-310), through the real
 * functions: checking stamps `doneAt`, Recent reads the Group's grocery lists
 * newest first, one per name, and putting an item back never duplicates it.
 */

const SLUG = 'jansen'

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

/** A distinct grocery name per number: digits would read as an amount. */
const name = (i: number) =>
  `zz${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}k`

type Seeded = Awaited<ReturnType<typeof seed>>

/** A keyed task refusal as it arrives (`@gather/core/refusals`). */
const refused = (code: TaskRefusalCode) => ({ data: { kind: `tasks:${code}` } })

/** Bob, signed up but in no Group of Alice's. */
async function signUpBob({ t }: Seeded) {
  await t.run((ctx) =>
    ctx.db.insert('users', {
      clerkId: bob.subject,
      name: bob.name,
      email: bob.email,
    }),
  )
}

/** The grocery list's last clear, as stored. */
async function clearedAt({ t, groceries }: Seeded) {
  return (await t.run((ctx) => ctx.db.get(groceries)))?.checkedClearedAt
}

/** A checked task written directly, checked at `doneAt`. */
async function checked(
  { t, userId }: Seeded,
  listId: Id<'taskLists'>,
  title: string,
  doneAt: number | undefined,
  extra: { quantity?: number; unit?: 'pak'; category?: 'dairy' } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert('tasks', {
      listId,
      title,
      done: true,
      doneAt,
      createdBy: userId,
      order: doneAt ?? 0,
      ...extra,
    }),
  )
}

describe('checking stamps when', () => {
  test('toggle, update and check-many stamp doneAt and unchecking clears it', async () => {
    const s = await seed()
    const { t, as, groceries } = s
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'melk',
    })
    const doneAt = async () =>
      (await t.run((ctx) => ctx.db.get(id)))?.doneAt
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId: id })
    expect(await doneAt()).toEqual(expect.any(Number))
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId: id })
    expect(await doneAt()).toBeUndefined()
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      done: true,
    })
    const first = await doneAt()
    expect(first).toEqual(expect.any(Number))
    // Setting the same state again keeps the original moment.
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      done: true,
    })
    expect(await doneAt()).toBe(first)
    await as.mutation(api.tasks.setDoneInList, {
      groupSlug: SLUG,
      listId: groceries,
      done: false,
    })
    expect(await doneAt()).toBeUndefined()
  })
})

describe('Recent', () => {
  test('newest first, across the Group grocery lists, one per name, not other lists', async () => {
    const s = await seed()
    await checked(s, s.groceries, 'melk', 100, {
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    await checked(s, s.market, 'Melk', 50)
    await checked(s, s.market, 'appels', 300)
    await checked(s, s.chores, 'stofzuigen', 400)
    // Checked long ago, stamped when it was added (APP-445).
    await checked(s, s.groceries, 'kaas', 10)
    // Checked with no stamp at all: never read.
    await checked(s, s.groceries, 'oude kaas', undefined)
    // Open with a stale stamp (a write that forgot to clear it): not checked.
    await s.t.run(async (ctx) => {
      await ctx.db.insert('tasks', {
        listId: s.groceries,
        title: 'brood',
        done: false,
        doneAt: 500,
        createdBy: s.userId,
        order: 9,
      })
    })
    const recent = await s.as.query(api.tasks.recentGroceries, {
      groupSlug: SLUG,
    })
    expect(recent.map((row) => row.title)).toEqual(['appels', 'melk', 'kaas'])
    expect(recent.slice(0, 2).map((row) => row.doneAt)).toEqual([300, 100])
    expect(recent[1]).toMatchObject({
      listId: s.groceries,
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
  })


  test('holds at most the limit', async () => {
    const s = await seed()
    await s.t.run(async (ctx) => {
      for (let i = 0; i < RECENT_GROCERIES_LIMIT + 20; i++) {
        await ctx.db.insert('tasks', {
          listId: s.groceries,
          title: name(i),
          done: true,
          doneAt: i + 1,
          createdBy: s.userId,
          order: i,
        })
      }
    })
    const recent = await s.as.query(api.tasks.recentGroceries, {
      groupSlug: SLUG,
    })
    expect(recent).toHaveLength(RECENT_GROCERIES_LIMIT)
    expect(recent[0]?.title).toBe(name(RECENT_GROCERIES_LIMIT + 19))
  })

  test('another Group cannot read it', async () => {
    const s = await seed()
    await s.t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      })
    })
    await expect(
      s.t.withIdentity(bob).query(api.tasks.recentGroceries, {
        groupSlug: SLUG,
      }),
    ).rejects.toThrow()
  })
})

describe('backfillDoneAt (APP-445)', () => {
  /** Every task's stamp, in insertion order. */
  const stamps = ({ t }: Seeded) =>
    t.run(async (ctx) =>
      (await ctx.db.query('tasks').collect()).map((task) => [
        task.title,
        task.doneAt ?? null,
      ]),
    )

  test('dry by default, then stamps checked items from when they were added, once', async () => {
    const s = await seed()
    await checked(s, s.groceries, 'oude kaas', undefined)
    await checked(s, s.chores, 'oud klusje', undefined)
    const stamped = await checked(s, s.groceries, 'melk', 100)
    const open = await s.as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: 'appels',
    })
    const before = await stamps(s)
    expect(
      await s.t.mutation(internal.maintenance.backfillDoneAt, {}),
    ).toMatchObject({ apply: false, scanned: 4, missing: 2, more: false })
    expect(await stamps(s)).toEqual(before)

    await s.t.mutation(internal.maintenance.backfillDoneAt, { apply: true })
    const rows = await s.t.run((ctx) => ctx.db.query('tasks').collect())
    for (const row of rows.filter((row) => row.title.startsWith('oud')))
      expect(row.doneAt).toBe(row._creationTime)
    expect(rows.find((row) => row._id === stamped)?.doneAt).toBe(100)
    expect(rows.find((row) => row._id === open)?.doneAt).toBeUndefined()
    expect(
      await s.t.mutation(internal.maintenance.backfillDoneAt, {}),
    ).toMatchObject({ missing: 0, more: false })
  })

  test('afterwards Recent and the habits read them, after every later check', async () => {
    const s = await seed()
    // Checked before doneAt existed, so added before any stamp was written.
    await checked(s, s.groceries, 'oud brood', undefined)
    await checked(s, s.groceries, 'oude kaas', undefined)
    await checked(s, s.market, 'oude appels', undefined)
    const later = Date.now() + 1000
    await checked(s, s.groceries, 'oud brood', later)
    await checked(s, s.market, 'melk', later + 1)
    await s.as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: 'kaas',
    })
    const read = async () => ({
      recent: await s.as.query(api.tasks.recentGroceries, { groupSlug: SLUG }),
      habits: await s.as.query(api.tasks.groceryHabits, {
        groupSlug: SLUG,
        listId: s.groceries,
      }),
    })
    // Without a stamp they are not read (APP-445 dropped that fallback).
    expect((await read()).recent.map((row) => row.title)).toEqual([
      'melk',
      'oud brood',
    ])
    await s.t.mutation(internal.maintenance.backfillDoneAt, { apply: true })
    const after = await read()
    // Newest added first, after the later checks; a later check of the same
    // name wins over the old one.
    expect(after.recent.map((row) => [row.title, row.doneAt])).toEqual([
      ['melk', later + 1],
      ['oud brood', later],
      ['oude appels', expect.any(Number)],
      ['oude kaas', expect.any(Number)],
    ])
    expect(after.habits.habits.map((habit) => habit.title).sort()).toEqual([
      'melk',
      'oud brood',
      'oude appels',
      'oude kaas',
    ])
  })

  test('pages by cursor until more is false', async () => {
    const s = await seed()
    for (const title of ['a', 'b', 'c'])
      await checked(s, s.groceries, `oud ${title}`, undefined)
    const first = await s.t.mutation(internal.maintenance.backfillDoneAt, {
      apply: true,
      batch: 2,
    })
    expect(first).toMatchObject({ scanned: 2, missing: 2, more: true })
    const second = await s.t.mutation(internal.maintenance.backfillDoneAt, {
      apply: true,
      batch: 2,
      cursor: first.cursor,
    })
    expect(second).toMatchObject({ scanned: 1, missing: 1, more: false })
    expect(
      await s.t.mutation(internal.maintenance.backfillDoneAt, {}),
    ).toMatchObject({ scanned: 3, missing: 0, more: false })
  })
})

describe('putting back from Recent', () => {
  test('on its own list a copy is added and the checked item stays history (APP-311)', async () => {
    const s = await seed()
    const id = await checked(s, s.groceries, 'melk', 100, {
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    const back = await s.as.mutation(api.tasks.putBack, {
      groupSlug: SLUG,
      taskId: id,
      listId: s.groceries,
    })
    expect(back).not.toBe(id)
    expect(await s.t.run((ctx) => ctx.db.get(back))).toMatchObject({
      listId: s.groceries,
      done: false,
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    expect(await s.t.run((ctx) => ctx.db.get(id))).toMatchObject({
      done: true,
      doneAt: 100,
    })
  })

  test('from another grocery list a copy is added with amount and aisle', async () => {
    const s = await seed()
    const id = await checked(s, s.market, 'melk', 100, {
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    const copy = await s.as.mutation(api.tasks.putBack, {
      groupSlug: SLUG,
      taskId: id,
      listId: s.groceries,
    })
    expect(copy).not.toBe(id)
    expect(await s.t.run((ctx) => ctx.db.get(copy))).toMatchObject({
      listId: s.groceries,
      title: 'melk',
      done: false,
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    expect((await s.t.run((ctx) => ctx.db.get(id)))?.done).toBe(true)
  })

  test('a name already open on the list is not added twice', async () => {
    const s = await seed()
    const id = await checked(s, s.market, 'melk', 100)
    const first = await s.as.mutation(api.tasks.putBack, {
      groupSlug: SLUG,
      taskId: id,
      listId: s.groceries,
    })
    const second = await s.as.mutation(api.tasks.putBack, {
      groupSlug: SLUG,
      taskId: id,
      listId: s.groceries,
    })
    expect(second).toBe(first)
    const open = await s.t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', s.groceries))
        .collect(),
    )
    expect(open).toHaveLength(1)
  })

  test('only onto a grocery list', async () => {
    const s = await seed()
    const id = await checked(s, s.groceries, 'melk', 100)
    await expect(
      s.as.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: s.chores,
      }),
    ).rejects.toMatchObject(refused('not-grocery-list'))
  })

  test('only from a grocery list', async () => {
    const s = await seed()
    const id = await checked(s, s.chores, 'melk', 100)
    await expect(
      s.as.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: s.groceries,
      }),
    ).rejects.toMatchObject(refused('not-grocery-list'))
    const open = await s.t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', s.groceries))
        .collect(),
    )
    expect(open).toHaveLength(0)
  })

  test('an open item older than the newest items is still found', async () => {
    const s = await seed()
    // The open "melk" is the list's oldest row, behind more checked rows
    // than the history window a recognition reads.
    const old = await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.groceries,
        title: 'Melk',
        done: false,
        createdBy: s.userId,
        order: -1,
      }),
    )
    for (let i = 0; i < GROCERY_HISTORY_WINDOW + 5; i++)
      await checked(s, s.groceries, name(i), 1000 + i)
    const id = await checked(s, s.market, 'melk', 100)
    const back = await s.as.mutation(api.tasks.putBack, {
      groupSlug: SLUG,
      taskId: id,
      listId: s.groceries,
    })
    expect(back).toBe(old)
    const melk = await s.t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list_and_done', (q) =>
          q.eq('listId', s.groceries).eq('done', false),
        )
        .collect(),
    )
    expect(melk.map((task) => task._id)).toEqual([old])
  })

  test('not onto a list linked to an outside service', async () => {
    const s = await seed()
    const linked = await s.t.run((ctx) =>
      ctx.db.insert('taskLists', {
        groupId: s.groupId,
        name: 'Todoist',
        provider: 'todoist',
        order: 3,
        kind: 'groceries',
      }),
    )
    const id = await checked(s, s.groceries, 'melk', 100)
    await expect(
      s.as.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: linked,
      }),
    ).rejects.toMatchObject(refused('read-only'))
  })

  test('a task or list of another Group is not found, and a stranger is refused', async () => {
    const s = await seed()
    const id = await checked(s, s.groceries, 'melk', 100)
    const other = await s.t.run(async (ctx) => {
      const groupId = await seedGroup(ctx, { name: 'smit', slug: 'smit' })
      await seedMember(ctx, groupId, s.userId, 'admin')
      return await ctx.db.insert('taskLists', {
        groupId,
        name: 'Boodschappen',
        provider: 'local',
        order: 0,
        kind: 'groceries',
      })
    })
    await expect(
      s.as.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: other,
      }),
    ).rejects.toMatchObject(refused('not-found'))
    await expect(
      s.as.mutation(api.tasks.putBack, {
        groupSlug: 'smit',
        taskId: id,
        listId: other,
      }),
    ).rejects.toMatchObject(refused('not-found'))
    await expect(
      s.t.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: s.groceries,
      }),
    ).rejects.toThrow()
    await signUpBob(s)
    await expect(
      s.t.withIdentity(bob).mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: s.groceries,
      }),
    ).rejects.toThrow('Not a member of that group')
  })
})

describe('Clear checked', () => {
  test('stamps the list, answers the previous moment, and undoes', async () => {
    const s = await seed()
    const first = await s.as.mutation(api.taskLists.clearChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    expect(first).toBeNull()
    const lists = await s.as.query(api.taskLists.list, { groupSlug: SLUG })
    const cleared = lists.find((l) => l._id === s.groceries)?.checkedClearedAt
    expect(cleared).toEqual(expect.any(Number))
    expect(
      lists.find((l) => l._id === s.chores)?.checkedClearedAt,
    ).toBeNull()

    const second = await s.as.mutation(api.taskLists.clearChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    expect(second).toBe(cleared)
    await s.as.mutation(api.taskLists.restoreCheckedCleared, {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: null,
    })
    const after = await s.as.query(api.taskLists.list, { groupSlug: SLUG })
    expect(
      after.find((l) => l._id === s.groceries)?.checkedClearedAt,
    ).toBeNull()
  })

  test('keeps the items in Recent', async () => {
    const s = await seed()
    await checked(s, s.groceries, 'melk', Date.now() - 1000)
    await s.as.mutation(api.taskLists.clearChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    const recent = await s.as.query(api.tasks.recentGroceries, {
      groupSlug: SLUG,
    })
    expect(recent.map((row) => row.title)).toEqual(['melk'])
  })

  test('only on a grocery list', async () => {
    const s = await seed()
    await expect(
      s.as.mutation(api.taskLists.clearChecked, {
        groupSlug: SLUG,
        listId: s.chores,
      }),
    ).rejects.toMatchObject(refused('not-grocery-list'))
  })

  test('the undoable clear answers its own moment and the one before', async () => {
    const s = await seed()
    const first = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    expect(first).toEqual({ clearedAt: expect.any(Number), previous: null })
    const second = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    expect(second.previous).toBe(first.clearedAt)
    expect(await clearedAt(s)).toBe(second.clearedAt)
  })
})

describe('undoing Clear checked', () => {
  /** Clear at a known moment: the list as if cleared then. */
  async function clearedThen(s: Seeded, at: number | undefined) {
    await s.t.run((ctx) => ctx.db.patch(s.groceries, { checkedClearedAt: at }))
  }

  test('puts back the moment before, when this clear is still the last', async () => {
    const s = await seed()
    await clearedThen(s, 1000)
    const clear = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    await s.as.mutation(api.taskLists.restoreCheckedCleared, {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: clear.previous,
      clearedAt: clear.clearedAt,
    })
    expect(await clearedAt(s)).toBe(1000)
  })

  test('refuses after another clear, and changes nothing', async () => {
    const s = await seed()
    const mine = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    // Another Member clears the list after this one.
    await clearedThen(s, mine.clearedAt + 5000)
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, {
        groupSlug: SLUG,
        listId: s.groceries,
        checkedClearedAt: mine.previous,
        clearedAt: mine.clearedAt,
      }),
    ).rejects.toMatchObject(refused('clear-superseded'))
    expect(await clearedAt(s)).toBe(mine.clearedAt + 5000)
  })

  test('refuses a second undo of the same clear', async () => {
    const s = await seed()
    await clearedThen(s, 1000)
    const clear = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    const undo = {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: clear.previous,
      clearedAt: clear.clearedAt,
    }
    await s.as.mutation(api.taskLists.restoreCheckedCleared, undo)
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, undo),
    ).rejects.toMatchObject(refused('clear-superseded'))
    expect(await clearedAt(s)).toBe(1000)
  })

  test('refuses a moment in the future or not before the clear', async () => {
    const s = await seed()
    const clear = await s.as.mutation(api.taskLists.clearCheckedUndoable, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    for (const checkedClearedAt of [Date.now() + 60_000, clear.clearedAt]) {
      await expect(
        s.as.mutation(api.taskLists.restoreCheckedCleared, {
          groupSlug: SLUG,
          listId: s.groceries,
          checkedClearedAt,
          clearedAt: clear.clearedAt,
        }),
      ).rejects.toMatchObject(refused('invalid-undo'))
    }
    // An installed phone passes no clearedAt; the future is refused too.
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, {
        groupSlug: SLUG,
        listId: s.groceries,
        checkedClearedAt: Date.now() + 60_000,
      }),
    ).rejects.toMatchObject(refused('invalid-undo'))
    expect(await clearedAt(s)).toBe(clear.clearedAt)
  })

  test('an installed phone without clearedAt can still undo its clear', async () => {
    const s = await seed()
    await clearedThen(s, 1000)
    const previous = await s.as.mutation(api.taskLists.clearChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
    })
    expect(previous).toBe(1000)
    await s.as.mutation(api.taskLists.restoreCheckedCleared, {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: previous,
    })
    expect(await clearedAt(s)).toBe(1000)
    // Put back already: the same undo again is refused.
    await clearedThen(s, 1000)
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, {
        groupSlug: SLUG,
        listId: s.groceries,
        checkedClearedAt: 1000,
      }),
    ).rejects.toMatchObject(refused('clear-superseded'))
  })

  test('only on a grocery list Gather can write to', async () => {
    const s = await seed()
    await clearedThen(s, 1000)
    await s.t.run((ctx) =>
      ctx.db.patch(s.chores, { checkedClearedAt: 2000 }),
    )
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, {
        groupSlug: SLUG,
        listId: s.chores,
        checkedClearedAt: null,
      }),
    ).rejects.toMatchObject(refused('not-grocery-list'))
    const linked = await s.t.run((ctx) =>
      ctx.db.insert('taskLists', {
        groupId: s.groupId,
        name: 'Todoist',
        provider: 'todoist',
        order: 3,
        kind: 'groceries',
        checkedClearedAt: 2000,
      }),
    )
    await expect(
      s.as.mutation(api.taskLists.restoreCheckedCleared, {
        groupSlug: SLUG,
        listId: linked,
        checkedClearedAt: null,
      }),
    ).rejects.toMatchObject(refused('read-only'))
    await expect(
      s.as.mutation(api.taskLists.clearCheckedUndoable, {
        groupSlug: SLUG,
        listId: linked,
      }),
    ).rejects.toMatchObject(refused('read-only'))
  })

  test('a stranger and a signed-out caller are refused', async () => {
    const s = await seed()
    const undo = {
      groupSlug: SLUG,
      listId: s.groceries,
      checkedClearedAt: null,
    }
    await expect(
      s.t.mutation(api.taskLists.restoreCheckedCleared, undo),
    ).rejects.toThrow()
    await expect(
      s.t.mutation(api.taskLists.clearCheckedUndoable, {
        groupSlug: SLUG,
        listId: s.groceries,
      }),
    ).rejects.toThrow()
    await signUpBob(s)
    const asBob = s.t.withIdentity(bob)
    await expect(
      asBob.mutation(api.taskLists.restoreCheckedCleared, undo),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      asBob.mutation(api.taskLists.clearCheckedUndoable, {
        groupSlug: SLUG,
        listId: s.groceries,
      }),
    ).rejects.toThrow('Not a member of that group')
  })
})
