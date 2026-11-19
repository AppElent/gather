import { describe, expect, test } from 'vitest'
import { alice, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * A grocery item's amount and unit (APP-309), through the real mutations: a
 * client sends them beside the name, a grocery list keeps them, any other
 * list keeps them in the title, and a move between the two carries them over.
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
    // A second grocery list, made as one but not the Group's own (APP-306).
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
    return { groceries, market, chores }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

async function row(t: Awaited<ReturnType<typeof seed>>['t'], id: Id<'tasks'>) {
  const task = await t.run((ctx) => ctx.db.get(id))
  return {
    title: task?.title,
    quantity: task?.quantity,
    unit: task?.unit,
    category: task?.category,
    listId: task?.listId,
  }
}

describe('adding with an amount', () => {
  test('a grocery list keeps the amount beside the name', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'melk',
      quantity: 2,
      unit: 'pak',
    })
    expect(await row(t, id)).toMatchObject({
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
  })

  test('the aisle is read with the unit: tinned tomatoes are not fresh ones', async () => {
    const { t, as, groceries } = await seed()
    const tins = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'tomaten',
      quantity: 2,
      unit: 'blik',
    })
    expect((await row(t, tins)).category).toBe('tins_sauces')
  })

  test('a list made as a grocery list gets amounts and aisles too', async () => {
    const { t, as, market } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: market,
      title: 'gehakt',
      quantity: 500,
      unit: 'g',
    })
    expect(await row(t, id)).toMatchObject({
      quantity: 500,
      unit: 'g',
      category: 'meat_fish',
    })
  })

  test('an installed app that sends the whole line keeps it as typed', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: '2 pakken melk',
    })
    expect(await row(t, id)).toMatchObject({
      title: '2 pakken melk',
      quantity: undefined,
      unit: undefined,
      category: 'dairy',
    })
  })

  test('a list without amounts keeps the amount in the title', async () => {
    const { t, as, chores } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: chores,
      title: 'lampjes',
      quantity: 3,
      unit: 'stuks',
    })
    expect(await row(t, id)).toMatchObject({
      title: '3 lampjes',
      quantity: undefined,
      unit: undefined,
      category: undefined,
    })
  })

  test.each([0, -1, 10_001, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s as an amount',
    async (quantity) => {
      const { as, groceries } = await seed()
      await expect(
        as.mutation(api.tasks.add, {
          groupSlug: SLUG,
          listId: groceries,
          title: 'melk',
          quantity,
        }),
      ).rejects.toThrow('That is not an amount')
    },
  )

  test('keeps three decimals', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'room',
      quantity: 1 / 3,
      unit: 'l',
    })
    expect((await row(t, id)).quantity).toBe(0.333)
  })
})

describe('changing the amount', () => {
  test('sets, changes and clears amount and unit', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'melk',
    })
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      quantity: 3,
      unit: 'fles',
    })
    expect(await row(t, id)).toMatchObject({ quantity: 3, unit: 'fles' })
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      quantity: null,
      unit: null,
    })
    expect(await row(t, id)).toMatchObject({
      quantity: undefined,
      unit: undefined,
      category: 'dairy',
    })
  })

  test('is ignored on a list without amounts', async () => {
    const { t, as, chores } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: chores,
      title: 'stofzuigen',
    })
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      quantity: 2,
      unit: 'pak',
    })
    expect(await row(t, id)).toMatchObject({
      quantity: undefined,
      unit: undefined,
    })
  })

  test('a chosen aisle is remembered for the Group', async () => {
    const { t, as, groceries } = await seed()
    const first = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'kwark',
    })
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: first,
      category: 'breakfast',
    })
    const second = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'kwark',
      quantity: 2,
      unit: 'bak',
    })
    expect((await row(t, second)).category).toBe('breakfast')
  })
})

describe('moving', () => {
  test('off a grocery list the amount goes into the title, and comes back', async () => {
    const { t, as, groceries, chores } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'melk',
      quantity: 2,
      unit: 'pak',
    })
    await as.mutation(api.tasks.moveToList, {
      groupSlug: SLUG,
      taskId: id,
      listId: chores,
    })
    expect(await row(t, id)).toMatchObject({
      title: '2 pak melk',
      quantity: undefined,
      unit: undefined,
      category: undefined,
    })
    await as.mutation(api.tasks.moveToList, {
      groupSlug: SLUG,
      taskId: id,
      listId: groceries,
    })
    expect(await row(t, id)).toMatchObject({
      title: 'melk',
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
  })

  test('between grocery lists the amount stays', async () => {
    const { t, as, groceries, market } = await seed()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'tomaten',
      quantity: 2,
      unit: 'blik',
    })
    await as.mutation(api.tasks.moveToList, {
      groupSlug: SLUG,
      taskId: id,
      listId: market,
    })
    expect(await row(t, id)).toMatchObject({
      listId: market,
      title: 'tomaten',
      quantity: 2,
      unit: 'blik',
      category: 'tins_sauces',
    })
  })
})

describe('the lists', () => {
  test('say which lists hold groceries', async () => {
    const { as } = await seed()
    const lists = await as.query(api.taskLists.list, { groupSlug: SLUG })
    expect(lists.map((list) => [list.name, list.grocery])).toEqual([
      ['Boodschappen', true],
      ['Markt', true],
      ['Klusjes', false],
    ])
  })
})
