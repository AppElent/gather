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
  return { t, as: t.withIdentity(alice), ...ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

/** `title` checked on `listId` this many days ago, once per entry. */
async function bought(
  { t, userId }: Seeded,
  listId: Id<'taskLists'>,
  title: string,
  daysAgo: number[],
  extra: { quantity?: number; unit?: 'pak'; category?: 'dairy' } = {},
) {
  const now = Date.now()
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
