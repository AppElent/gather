import { GROCERY_AISLES } from '@gather/core/groceries'
import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'

/**
 * Several grocery lists per Group, one per store, each with its own aisle
 * order (APP-313), and the expand step around `groups.groceryListId`: the
 * backfill, and the functions installed phones still call.
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
    // The Group's grocery list from before kinds: a plain list it names.
    const ah = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Albert Heijn',
      provider: 'local',
      order: 0,
    })
    const market = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Markt zaterdag',
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
    await ctx.db.patch(groupId, { groceryListId: ah })
    return { userId, groupId, ah, market, chores }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

describe('backfillGroceryListKind', () => {
  test('dry by default, then makes each named grocery list kind groceries once', async () => {
    const { t, as, ah, market, chores } = await seed()
    const kinds = () =>
      t.run(async (ctx) =>
        Promise.all(
          [ah, market, chores].map(
            async (id) => (await ctx.db.get(id))?.kind ?? null,
          ),
        ),
      )

    expect(
      await t.mutation(internal.maintenance.backfillGroceryListKind, {}),
    ).toMatchObject({ apply: false, scanned: 1, missing: 1, more: false })
    expect(await kinds()).toEqual([null, 'groceries', null])

    await t.mutation(internal.maintenance.backfillGroceryListKind, {
      apply: true,
    })
    expect(await kinds()).toEqual(['groceries', 'groceries', null])
    expect(
      await t.mutation(internal.maintenance.backfillGroceryListKind, {}),
    ).toMatchObject({ missing: 0, more: false })

    // The legacy field stays, and installed phones read it as before.
    expect(await as.query(api.kitchen.groceries, { groupSlug: SLUG })).toEqual({
      groceryListId: ah,
    })
    // Both are grocery lists to every reader; the chores list is not.
    const lists = await as.query(api.taskLists.list, { groupSlug: SLUG })
    expect(lists.map((list) => [list.name, list.grocery])).toEqual([
      ['Albert Heijn', true],
      ['Markt zaterdag', true],
      ['Klusjes', false],
    ])
  })

  test('pages by cursor and leaves a pointer at another Group alone', async () => {
    const t = testConvex()
    const ids = await t.run(async (ctx) => {
      const made = []
      for (const slug of ['a', 'b', 'c']) {
        const groupId = await seedGroup(ctx, { name: slug, slug })
        const listId = await ctx.db.insert('taskLists', {
          groupId,
          name: 'Boodschappen',
          provider: 'local',
          order: 0,
        })
        made.push({ groupId, listId })
      }
      // Group c names Group a's list: never readable, so never converted.
      await ctx.db.patch(made[0].groupId, { groceryListId: made[0].listId })
      await ctx.db.patch(made[1].groupId, { groceryListId: made[1].listId })
      await ctx.db.patch(made[2].groupId, { groceryListId: made[0].listId })
      return made
    })
    const first = await t.mutation(
      internal.maintenance.backfillGroceryListKind,
      { apply: true, batch: 2 },
    )
    expect(first).toMatchObject({ scanned: 2, missing: 2, more: true })
    const second = await t.mutation(
      internal.maintenance.backfillGroceryListKind,
      { apply: true, batch: 2, cursor: first.cursor },
    )
    expect(second).toMatchObject({ scanned: 1, missing: 0, more: false })
    expect(
      await t.mutation(internal.maintenance.backfillGroceryListKind, {}),
    ).toMatchObject({ scanned: 3, missing: 0, more: false })
    const kinds = await t.run(async (ctx) =>
      Promise.all(
        ids.map(async ({ listId }) => (await ctx.db.get(listId))?.kind ?? null),
      ),
    )
    expect(kinds).toEqual(['groceries', 'groceries', null])
  })
})

describe('installed phones', () => {
  test('setGroceryList still points the Group, and the list becomes a grocery list', async () => {
    const { t, as, groupId, chores } = await seed()
    await as.mutation(api.kitchen.setGroceryList, {
      groupSlug: SLUG,
      listId: chores,
    })
    const after = await t.run(async (ctx) => ({
      group: await ctx.db.get(groupId),
      list: await ctx.db.get(chores),
    }))
    expect(after.group?.groceryListId).toBe(chores)
    expect(after.list?.kind).toBe('groceries')
    // Unlinking leaves the list a grocery list, and the Group without one.
    await as.mutation(api.kitchen.setGroceryList, {
      groupSlug: SLUG,
      listId: null,
    })
    expect(
      await as.query(api.kitchen.groceries, { groupSlug: SLUG }),
    ).toEqual({ groceryListId: null })
    expect((await t.run((ctx) => ctx.db.get(chores)))?.kind).toBe('groceries')
  })

  test('deleting the named list points the Group at its next grocery list', async () => {
    const { as, ah, market } = await seed()
    await as.mutation(api.taskLists.remove, { groupSlug: SLUG, listId: ah })
    expect(
      await as.query(api.kitchen.groceries, { groupSlug: SLUG }),
    ).toEqual({ groceryListId: market })
    await as.mutation(api.taskLists.remove, { groupSlug: SLUG, listId: market })
    expect(
      await as.query(api.kitchen.groceries, { groupSlug: SLUG }),
    ).toEqual({ groceryListId: null })
  })
})

describe('aisle order', () => {
  test('each list keeps its own order; null restores the default', async () => {
    const { as, ah, market } = await seed()
    const read = async () =>
      Object.fromEntries(
        (await as.query(api.taskLists.list, { groupSlug: SLUG })).map(
          (list) => [list.name, list.aisleOrder],
        ),
      )
    expect(await read()).toMatchObject({
      'Albert Heijn': null,
      'Markt zaterdag': null,
    })

    await as.mutation(api.taskLists.setAisleOrder, {
      groupSlug: SLUG,
      listId: market,
      order: ['produce', 'cheese_deli', 'meat_fish', 'bakery'],
    })
    await as.mutation(api.taskLists.setAisleOrder, {
      groupSlug: SLUG,
      listId: ah,
      order: [...GROCERY_AISLES].reverse(),
    })
    const both = await read()
    // A partial order is stored whole: the aisles it left out follow.
    expect(both['Markt zaterdag']?.slice(0, 4)).toEqual([
      'produce',
      'cheese_deli',
      'meat_fish',
      'bakery',
    ])
    expect(both['Markt zaterdag']).toHaveLength(GROCERY_AISLES.length)
    expect(both['Albert Heijn']).toEqual([...GROCERY_AISLES].reverse())

    await as.mutation(api.taskLists.setAisleOrder, {
      groupSlug: SLUG,
      listId: ah,
      order: null,
    })
    // Saving the default order is the same as restoring it.
    await as.mutation(api.taskLists.setAisleOrder, {
      groupSlug: SLUG,
      listId: market,
      order: [...GROCERY_AISLES],
    })
    expect(await read()).toMatchObject({
      'Albert Heijn': null,
      'Markt zaterdag': null,
    })
  })

  test('refused on a list that is not a grocery list, repeats, and other Groups', async () => {
    const { t, as, chores, market } = await seed()
    await expect(
      as.mutation(api.taskLists.setAisleOrder, {
        groupSlug: SLUG,
        listId: chores,
        order: ['produce'],
      }),
    ).rejects.toThrow('That is not a grocery list')
    await expect(
      as.mutation(api.taskLists.setAisleOrder, {
        groupSlug: SLUG,
        listId: market,
        order: ['produce', 'produce'],
      }),
    ).rejects.toThrow('each aisle once')

    await t.run(async (ctx) => {
      const bobId = await ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      })
      const other = await seedGroup(ctx, { name: 'other', slug: 'other' })
      await seedMember(ctx, other, bobId, 'admin')
    })
    await expect(
      t.withIdentity(bob).mutation(api.taskLists.setAisleOrder, {
        groupSlug: 'other',
        listId: market,
        order: null,
      }),
    ).rejects.toThrow()
  })
})

describe('moving an item between grocery lists', () => {
  test('keeps its amount, unit and aisle', async () => {
    const { t, as, userId, ah, market } = await seed()
    const taskId = await t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: ah,
        // A name the dictionary would put in another aisle: the Member's
        // choice is what has to survive the move.
        title: 'melk',
        quantity: 2,
        unit: 'pak',
        category: 'drinks',
        done: false,
        createdBy: userId,
        order: 0,
      }),
    )
    await as.mutation(api.tasks.moveToList, {
      groupSlug: SLUG,
      taskId,
      listId: market,
    })
    const moved = await t.run((ctx) => ctx.db.get(taskId))
    expect(moved).toMatchObject({
      listId: market,
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      category: 'drinks',
    })
  })

  test('onto a grocery list from another list, the aisle is recognised', async () => {
    const { t, as, userId, chores, market } = await seed()
    const taskId = await t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: chores,
        title: '2 pak melk',
        done: false,
        createdBy: userId,
        order: 0,
      }),
    )
    await as.mutation(api.tasks.moveToList, {
      groupSlug: SLUG,
      taskId,
      listId: market,
    })
    expect(await t.run((ctx) => ctx.db.get(taskId))).toMatchObject({
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
  })
})
