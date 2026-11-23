import { DAY_MS } from '@gather/core/groceries'
import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { GROCERY_HABITS_WINDOW } from './tasks'

/**
 * "Maybe needed" and the composer's history (APP-311), through the real
 * functions: the Group's checked grocery items are its history, and the
 * strip is what is due, not on the list, not hidden, and not switched off.
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
  // One clock for every purchase a test seeds: two `bought` calls a few
  // milliseconds apart would stretch the gaps between them, and with them the
  // usual interval, past the time since the last one on a slow runner.
  return { t, as: t.withIdentity(alice), now: Date.now(), ...ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

/** `title` checked on `listId` this many days ago, once per entry. */
async function bought(
  { t, userId, now }: Seeded,
  listId: Id<'taskLists'>,
  title: string,
  daysAgo: number[],
  extra: { quantity?: number; unit?: 'pak'; category?: 'dairy' } = {},
) {
  await t.run(async (ctx) => {
    for (const days of daysAgo)
      await ctx.db.insert('tasks', {
        listId,
        title,
        done: true,
        doneAt: now - days * DAY_MS,
        createdBy: userId,
        order: 0,
        ...extra,
      })
  })
}

async function open({ t, userId }: Seeded, listId: Id<'taskLists'>, title: string) {
  await t.run((ctx) =>
    ctx.db.insert('tasks', {
      listId,
      title,
      done: false,
      createdBy: userId,
      order: 0,
    }),
  )
}

const read = (s: Seeded, listId: Id<'taskLists'> = s.groceries) =>
  s.as.query(api.tasks.groceryHabits, { groupSlug: SLUG, listId })

const titles = (rows: { title: string }[]) => rows.map((row) => row.title)

describe('groceryHabits', () => {
  test('suggests what is due, with its usual interval and amount', async () => {
    const s = await seed()
    // Every 4 days, last 5 days ago: due.
    await bought(s, s.groceries, 'melk', [17, 13, 9, 5], {
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    // Weekly, last 2 days ago: not yet.
    await bought(s, s.groceries, 'eieren', [16, 9, 2])
    // Twice only: never.
    await bought(s, s.groceries, 'pindakaas', [30, 10])
    const { suggestions, habits } = await read(s)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({
      title: 'melk',
      count: 4,
      intervalDays: 4,
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    expect(titles(habits)).toEqual(['melk', 'eieren', 'pindakaas'])
  })

  test('reads the history of every grocery list of the Group, not other lists', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8])
    await bought(s, s.market, 'Melk', [4])
    await bought(s, s.chores, 'stofzuigen', [21, 14, 7, 0])
    const { suggestions, habits } = await read(s)
    expect(titles(suggestions)).toEqual(['Melk'])
    expect(titles(habits)).toEqual(['Melk'])
  })

  test('leaves out a name that is open on the list, in any spelling', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8, 4])
    await bought(s, s.groceries, 'brood', [3, 2, 1])
    await open(s, s.groceries, '2 pakken Melk')
    expect(titles((await read(s)).suggestions)).toEqual(['brood'])
    // Open on another grocery list does not count for this one.
    // Both bought three times: the most recently bought comes first.
    expect(titles((await read(s, s.market)).suggestions)).toEqual([
      'brood',
      'melk',
    ])
  })

  test('shows at most eight, most bought first', async () => {
    const s = await seed()
    for (let i = 0; i < 10; i++)
      await bought(
        s,
        s.groceries,
        `item ${String.fromCharCode(97 + i)}`,
        Array.from({ length: 3 + i }, (_, n) => 2 + n),
      )
    const { suggestions } = await read(s)
    expect(suggestions).toHaveLength(8)
    expect(suggestions[0].title).toBe('item j')
  })

  test('counts an item checked before doneAt existed at when it was added', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8])
    // Checked before APP-310: no stamp, so it counts at its creation, now.
    await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.groceries,
        title: 'Melk',
        done: true,
        createdBy: s.userId,
        order: 0,
      }),
    )
    const { habits, suggestions } = await read(s)
    expect(habits[0]).toMatchObject({ title: 'Melk', count: 3 })
    // Bought "today", so not due yet.
    expect(suggestions).toEqual([])
  })

  test('measures due from the now it is sent, the server clock without one (APP-427)', async () => {
    const s = await seed()
    // Every 4 days, last 2 days ago: not due now, due three days on.
    await bought(s, s.groceries, 'melk', [14, 10, 6, 2])
    expect((await read(s)).suggestions).toEqual([])
    const later = await s.as.query(api.tasks.groceryHabits, {
      groupSlug: SLUG,
      listId: s.groceries,
      now: Date.now() + 3 * DAY_MS,
    })
    expect(titles(later.suggestions)).toEqual(['melk'])
  })

  test('reads the newest history across all grocery lists, capped in all (APP-427)', async () => {
    const s = await seed()
    const now = Date.now()
    const extra = 50
    // One purchase a day, so each is a trip of its own. The market list
    // holds the newest; the oldest on the household grocery list fall
    // outside the window.
    await s.t.run(async (ctx) => {
      for (let i = 0; i < GROCERY_HABITS_WINDOW; i++)
        await ctx.db.insert('tasks', {
          listId: s.groceries,
          title: 'melk',
          done: true,
          doneAt: now - (100 + i) * DAY_MS,
          createdBy: s.userId,
          order: 0,
        })
      for (let i = 0; i < extra; i++)
        await ctx.db.insert('tasks', {
          listId: s.market,
          title: 'brood',
          done: true,
          doneAt: now - i * DAY_MS,
          createdBy: s.userId,
          order: 0,
        })
    })
    const { habits } = await read(s)
    const count = (title: string) =>
      habits.find((habit) => habit.title === title)?.count
    expect(count('brood')).toBe(extra)
    expect(count('melk')).toBe(GROCERY_HABITS_WINDOW - extra)
  })

  test('answers nothing for a list that is not a grocery list', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8, 4])
    expect(await read(s, s.chores)).toEqual({ habits: [], suggestions: [] })
  })

  test('refuses someone outside the Group', async () => {
    const s = await seed()
    await s.t.run((ctx) =>
      ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      }),
    )
    await expect(
      s.t.withIdentity(bob).query(api.tasks.groceryHabits, {
        groupSlug: SLUG,
        listId: s.groceries,
      }),
    ).rejects.toThrow()
  })
})

describe('hiding a suggestion', () => {
  test('hides the name for good on that list, and undo brings it back', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8, 4])
    await bought(s, s.groceries, 'brood', [3, 2, 1])
    await s.as.mutation(api.taskLists.hideSuggestion, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: 'Melk',
    })
    expect(titles((await read(s)).suggestions)).toEqual(['brood'])
    // Still in the composer's history.
    expect(titles((await read(s)).habits)).toContain('melk')
    // Hiding twice keeps one entry.
    await s.as.mutation(api.taskLists.hideSuggestion, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: '2 pak melk',
    })
    expect(
      (await s.t.run((ctx) => ctx.db.get(s.groceries)))?.hiddenSuggestions,
    ).toEqual(['melk'])

    await s.as.mutation(api.taskLists.unhideSuggestion, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: 'melk',
    })
    expect(titles((await read(s)).suggestions)).toEqual(['brood', 'melk'])
    expect(
      (await s.t.run((ctx) => ctx.db.get(s.groceries)))?.hiddenSuggestions,
    ).toBeUndefined()
  })

  test('keeps at most 500 names, dropping the oldest', async () => {
    const s = await seed()
    const names = Array.from({ length: 500 }, (_, i) => `zz${i}k`)
    await s.t.run((ctx) =>
      ctx.db.patch(s.groceries, { hiddenSuggestions: names }),
    )
    await s.as.mutation(api.taskLists.hideSuggestion, {
      groupSlug: SLUG,
      listId: s.groceries,
      title: 'melk',
    })
    const hidden = (await s.t.run((ctx) => ctx.db.get(s.groceries)))
      ?.hiddenSuggestions
    expect(hidden).toHaveLength(500)
    expect(hidden?.[0]).toBe('zz1k')
    expect(hidden?.at(-1)).toBe('melk')
  })

  test('refuses a title longer than a grocery line', async () => {
    const s = await seed()
    await expect(
      s.as.mutation(api.taskLists.hideSuggestion, {
        groupSlug: SLUG,
        listId: s.groceries,
        title: 'm'.repeat(501),
      }),
    ).rejects.toThrow('That is not an item')
  })

  test('refuses a list that is not a grocery list', async () => {
    const s = await seed()
    await expect(
      s.as.mutation(api.taskLists.hideSuggestion, {
        groupSlug: SLUG,
        listId: s.chores,
        title: 'melk',
      }),
    ).rejects.toThrow('That is not a grocery list')
  })
})

describe('switching suggestions off', () => {
  test('empties the strip, keeps the history, and shows on the list row', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8, 4])
    await s.as.mutation(api.taskLists.setSuggestions, {
      groupSlug: SLUG,
      listId: s.groceries,
      on: false,
    })
    const off = await read(s)
    expect(off.suggestions).toEqual([])
    expect(titles(off.habits)).toEqual(['melk'])
    const lists = await s.as.query(api.taskLists.list, { groupSlug: SLUG })
    expect(lists.find((l) => l._id === s.groceries)?.suggestionsOff).toBe(true)
    // The other grocery list keeps its own setting.
    expect(titles((await read(s, s.market)).suggestions)).toEqual(['melk'])

    await s.as.mutation(api.taskLists.setSuggestions, {
      groupSlug: SLUG,
      listId: s.groceries,
      on: true,
    })
    expect(titles((await read(s)).suggestions)).toEqual(['melk'])
    expect(
      (await s.t.run((ctx) => ctx.db.get(s.groceries)))?.suggestionsOff,
    ).toBeUndefined()
  })
})

describe('putting back from Recent keeps the history (APP-311)', () => {
  test('three put-backs of the same item count as three purchases', async () => {
    const s = await seed()
    const now = Date.now()
    const first = await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.groceries,
        title: 'melk',
        done: true,
        doneAt: now - 12 * DAY_MS,
        createdBy: s.userId,
        order: 0,
      }),
    )
    let id = first
    for (const days of [8, 4]) {
      id = await s.as.mutation(api.tasks.putBack, {
        groupSlug: SLUG,
        taskId: id,
        listId: s.groceries,
      })
      await s.t.run((ctx) =>
        ctx.db.patch(id, { done: true, doneAt: now - days * DAY_MS }),
      )
    }
    const { suggestions } = await read(s)
    expect(suggestions[0]).toMatchObject({ title: 'melk', count: 3 })
  })
})

describe('Put back all keeps the history (APP-427)', () => {
  async function checked(s: Seeded, title: string, daysAgo: number) {
    return await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.groceries,
        title,
        done: true,
        doneAt: Date.now() - daysAgo * DAY_MS,
        createdBy: s.userId,
        order: 0,
        quantity: 2,
        unit: 'pak',
        category: 'dairy',
      }),
    )
  }

  const tasksOn = (s: Seeded, listId: Id<'taskLists'>) =>
    s.t.run((ctx) =>
      ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', listId))
        .collect(),
    )

  test('adds open copies and leaves the checked items as purchases', async () => {
    const s = await seed()
    await bought(s, s.groceries, 'melk', [12, 8])
    const melk = await checked(s, 'melk', 4)
    const kaas = await checked(s, 'kaas', 3)
    const added = await s.as.mutation(api.tasks.putBackChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
      taskIds: [melk, kaas],
    })
    expect(added).toHaveLength(2)
    const rows = await tasksOn(s, s.groceries)
    for (const id of [melk, kaas])
      expect(rows.find((row) => row._id === id)).toMatchObject({ done: true })
    const copies = rows.filter((row) => added.includes(row._id))
    expect(copies.map((row) => row.title).sort()).toEqual(['kaas', 'melk'])
    expect(copies[0]).toMatchObject({
      done: false,
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
    // Three purchases of melk still count; it is open now, so not suggested.
    const { habits, suggestions } = await read(s)
    expect(habits.find((h) => h.title === 'melk')?.count).toBe(3)
    expect(titles(suggestions)).toEqual([])
  })

  test('adds a name once, and not when it is already open', async () => {
    const s = await seed()
    const a = await checked(s, 'melk', 4)
    const b = await checked(s, 'Melk', 2)
    const kaas = await checked(s, 'kaas', 2)
    await open(s, s.groceries, 'kaas')
    const added = await s.as.mutation(api.tasks.putBackChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
      taskIds: [a, b, kaas],
    })
    expect(added).toHaveLength(1)
    const rows = await tasksOn(s, s.groceries)
    expect(rows.filter((row) => !row.done).map((row) => row.title).sort()).toEqual([
      'kaas',
      'melk',
    ])
  })

  test('skips an item unchecked meanwhile, refuses one on another list', async () => {
    const s = await seed()
    await open(s, s.groceries, 'kaas')
    const [kaas] = (await tasksOn(s, s.groceries)).filter((row) => !row.done)
    const melk = await checked(s, 'melk', 1)
    const added = await s.as.mutation(api.tasks.putBackChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
      taskIds: [kaas._id, melk],
    })
    expect(added).toHaveLength(1)
    const elsewhere = await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.market,
        title: 'brood',
        done: true,
        doneAt: Date.now(),
        createdBy: s.userId,
        order: 0,
      }),
    )
    await expect(
      s.as.mutation(api.tasks.putBackChecked, {
        groupSlug: SLUG,
        listId: s.groceries,
        taskIds: [elsewhere],
      }),
    ).rejects.toThrow()
  })

  test('only onto a grocery list, and not for a stranger', async () => {
    const s = await seed()
    const chore = await s.t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: s.chores,
        title: 'stofzuigen',
        done: true,
        doneAt: Date.now(),
        createdBy: s.userId,
        order: 0,
      }),
    )
    await expect(
      s.as.mutation(api.tasks.putBackChecked, {
        groupSlug: SLUG,
        listId: s.chores,
        taskIds: [chore],
      }),
    ).rejects.toThrow()
    const melk = await checked(s, 'melk', 1)
    await s.t.run((ctx) =>
      ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      }),
    )
    await expect(
      s.t.withIdentity(bob).mutation(api.tasks.putBackChecked, {
        groupSlug: SLUG,
        listId: s.groceries,
        taskIds: [melk],
      }),
    ).rejects.toThrow()
  })

  test('undo removes the copies still open, never the checked items', async () => {
    const s = await seed()
    const melk = await checked(s, 'melk', 4)
    const kaas = await checked(s, 'kaas', 3)
    const added = await s.as.mutation(api.tasks.putBackChecked, {
      groupSlug: SLUG,
      listId: s.groceries,
      taskIds: [melk, kaas],
    })
    // One copy was bought again before the undo: it stays.
    await s.t.run((ctx) => ctx.db.patch(added[0], { done: true, doneAt: Date.now() }))
    const removed = await s.as.mutation(api.tasks.removePutBack, {
      groupSlug: SLUG,
      listId: s.groceries,
      taskIds: [...added, melk],
    })
    expect(removed).toBe(1)
    const ids = (await tasksOn(s, s.groceries)).map((row) => row._id).sort()
    expect(ids).toEqual([melk, kaas, added[0]].sort())
  })
})
