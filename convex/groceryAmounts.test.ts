import { describe, expect, test } from 'vitest'
import { alice, bob, seedGroup, seedMember, testConvex } from '../test/convexHarness'
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
      title: '3 stuks lampjes',
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

describe('two Members at once (APP-671)', () => {
  async function seedMelk() {
    const seeded = await seed()
    const { t, as, groceries } = seeded
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      })
      const group = await ctx.db.query('groups').first()
      if (group) await seedMember(ctx, group._id, userId, 'member')
    })
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'melk',
      quantity: 1,
      unit: 'pak',
    })
    return { ...seeded, asBob: t.withIdentity(bob), id }
  }
  const changed = { data: { kind: 'tasks:amount-changed' } }
  const pak = (quantity: number) => ({ quantity, unit: 'pak' as const })

  test('amounts added at the same moment both count', async () => {
    const { t, as, asBob, id } = await seedMelk()
    await Promise.all([
      as.mutation(api.tasks.addAmount, { groupSlug: SLUG, taskId: id, ...pak(2) }),
      asBob.mutation(api.tasks.addAmount, { groupSlug: SLUG, taskId: id, ...pak(1) }),
    ])
    expect(await row(t, id)).toMatchObject(pak(4))
  })

  test('only one of two changes from the same amount lands', async () => {
    const { t, as, asBob, id } = await seedMelk()
    const set = (who: typeof as, quantity: number) =>
      who.mutation(api.tasks.update, {
        groupSlug: SLUG,
        taskId: id,
        ...pak(quantity),
        expectedAmount: pak(1),
      })
    const [first, second] = await Promise.allSettled([set(as, 3), set(asBob, 2)])
    expect(first.status).toBe('fulfilled')
    expect(second).toMatchObject({ status: 'rejected', reason: changed })
    expect(await row(t, id)).toMatchObject(pak(3))
  })

  test('an undo gives an amount back, unless another Member changed it', async () => {
    const { t, as, asBob, id } = await seedMelk()
    const add = () =>
      as.mutation(api.tasks.addAmount, { groupSlug: SLUG, taskId: id, ...pak(2) })
    const undo = ({ from, to }: Awaited<ReturnType<typeof add>>) =>
      as.mutation(api.tasks.update, {
        groupSlug: SLUG,
        taskId: id,
        ...from,
        expectedAmount: to,
      })
    const first = await add()
    expect(first).toEqual({ from: pak(1), to: pak(3) })
    await undo(first)
    expect(await row(t, id)).toMatchObject(pak(1))

    const second = await add()
    await asBob.mutation(api.tasks.addAmount, { groupSlug: SLUG, taskId: id, ...pak(1) })
    await expect(undo(second)).rejects.toMatchObject(changed)
    expect(await row(t, id)).toMatchObject(pak(4))
  })

  test('no amount is one, and its undo is no amount again', async () => {
    const { t, as, groceries } = await seedMelk()
    const id = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'kaas',
    })
    const none = { quantity: null, unit: null }
    expect(
      await as.mutation(api.tasks.addAmount, {
        groupSlug: SLUG,
        taskId: id,
        quantity: 2,
      }),
    ).toEqual({ from: none, to: { quantity: 3, unit: null } })
    await as.mutation(api.tasks.update, {
      groupSlug: SLUG,
      taskId: id,
      ...none,
      expectedAmount: { quantity: 3, unit: null },
    })
    expect((await row(t, id)).quantity).toBeUndefined()
  })

  test('adding is refused when it does not add up, or is not an amount', async () => {
    const { t, as, asBob, chores, id } = await seedMelk()
    const add = (more: { quantity: number; unit?: 'g' }) =>
      as.mutation(api.tasks.addAmount, { groupSlug: SLUG, taskId: id, ...more })
    await expect(add({ quantity: 500, unit: 'g' })).rejects.toMatchObject(changed)
    await expect(add({ quantity: -1 })).rejects.toThrow('That is not an amount')
    expect(await row(t, id)).toMatchObject(pak(1))
    const chore = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: chores,
      title: 'stofzuigen',
    })
    await expect(
      asBob.mutation(api.tasks.addAmount, {
        groupSlug: SLUG,
        taskId: chore,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ data: { kind: 'tasks:not-grocery-list' } })
  })

  test('adding is for Members', async () => {
    const { t, as, id } = await seedMelk()
    const more = { groupSlug: SLUG, taskId: id, quantity: 1 }
    await expect(t.mutation(api.tasks.addAmount, more)).rejects.toMatchObject({
      data: { kind: 'groups:not-signed-in' },
    })
    await t.run(async (ctx) => {
      const other = await seedGroup(ctx, { name: 'other', slug: 'other' })
      const user = await ctx.db.query('users').first()
      if (user) await seedMember(ctx, other, user._id, 'admin')
    })
    await expect(
      as.mutation(api.tasks.addAmount, { ...more, groupSlug: 'other' }),
    ).rejects.toThrow('Task not found')
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
