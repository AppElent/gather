import { describe, expect, test } from 'vitest'
import { alice, bob, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Groceries "In stock" (APP-314): staples in stock or running low, running
 * low puts one on the grocery list, checking it off there restocks it, and
 * the Pantry's rows are copied in by `maintenance:migratePantryToStaples`.
 */

const SLUG = 'jansen'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: bob.name,
      email: bob.email,
    })
    const groupId = await seedGroup(ctx, { name: SLUG, slug: SLUG })
    await seedMember(ctx, groupId, aliceId, 'admin')
    const otherGroup = await seedGroup(ctx, { name: 'other', slug: 'other' })
    await seedMember(ctx, otherGroup, bobId, 'admin')
    const groceries = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Albert Heijn',
      provider: 'local',
      order: 0,
    })
    const chores = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Klusjes',
      provider: 'local',
      order: 1,
    })
    await ctx.db.patch(groupId, { groceryListId: groceries })
    return { aliceId, bobId, groupId, otherGroup, groceries, chores }
  })
  return { t, as: t.withIdentity(alice), asBob: t.withIdentity(bob), ...ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

async function itemsOn(t: Seeded['t'], listId: Id<'taskLists'>) {
  return await t.run((ctx) =>
    ctx.db
      .query('tasks')
      .withIndex('by_list', (q) => q.eq('listId', listId))
      .collect(),
  )
}

async function staple(t: Seeded['t'], id: Id<'groceryStaples'>) {
  return await t.run((ctx) => ctx.db.get(id))
}

describe('staples', () => {
  test('a new staple is in stock, in its aisle, and named once per Group', async () => {
    const { t, as } = await seed()
    const id = await as.mutation(api.groceryStaples.add, {
      groupSlug: SLUG,
      name: '  Melk ',
    })
    expect(await staple(t, id)).toMatchObject({
      name: 'Melk',
      key: 'melk',
      aisle: 'dairy',
      low: false,
    })
    expect(
      await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'melk' }),
    ).toBe(id)
    const { staples, list } = await as.query(api.groceryStaples.list, {
      groupSlug: SLUG,
    })
    expect(list?.name).toBe('Albert Heijn')
    expect(staples).toHaveLength(1)
    await expect(
      as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: '   ' }),
    ).rejects.toThrow('That is not a name')
  })

  test('running low puts it on the grocery list once', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.groceryStaples.add, {
      groupSlug: SLUG,
      name: 'Koffiebonen',
    })
    expect(
      await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true }),
    ).toEqual({ onList: true })
    await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true })
    const items = await itemsOn(t, groceries)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: 'Koffiebonen', done: false })
    const { staples } = await as.query(api.groceryStaples.list, { groupSlug: SLUG })
    expect(staples[0]).toMatchObject({ low: true, onList: true })
  })

  test('an item already open on the list is not added again', async () => {
    const { t, as, groceries } = await seed()
    await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: groceries,
      title: 'Rijst',
      quantity: 2,
      unit: 'zak',
    })
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'rijst' })
    await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true })
    expect(await itemsOn(t, groceries)).toHaveLength(1)
  })

  test('without a grocery list it is low but on no list', async () => {
    const { t, as, groupId } = await seed()
    await t.run((ctx) => ctx.db.patch(groupId, { groceryListId: undefined }))
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Uien' })
    expect(
      await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true }),
    ).toEqual({ onList: false })
    expect((await staple(t, id))?.low).toBe(true)
  })

  test('checking it off on the list puts it back in stock', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Knoflook' })
    await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true })
    const [item] = await itemsOn(t, groceries)
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId: item._id })
    expect((await staple(t, id))?.low).toBe(false)
    // Unchecking it again does not make it low.
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId: item._id })
    expect((await staple(t, id))?.low).toBe(false)
  })

  test('every way of checking off restocks: update and check-all', async () => {
    const { t, as, groceries } = await seed()
    const oil = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Olijfolie' })
    const rice = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Rijst' })
    for (const id of [oil, rice])
      await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true })
    const items = await itemsOn(t, groceries)
    const oilItem = items.find((item) => item.title === 'Olijfolie')
    if (!oilItem) throw new Error('no oil on the list')
    await as.mutation(api.tasks.update, { groupSlug: SLUG, taskId: oilItem._id, done: true })
    expect((await staple(t, oil))?.low).toBe(false)
    expect((await staple(t, rice))?.low).toBe(true)
    await as.mutation(api.tasks.setDoneInList, {
      groupSlug: SLUG,
      listId: groceries,
      done: true,
    })
    expect((await staple(t, rice))?.low).toBe(false)
  })

  test('an item with an amount in its title still restocks', async () => {
    const { t, as, groceries, aliceId } = await seed()
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Melk' })
    await t.run((ctx) => ctx.db.patch(id, { low: true }))
    // An installed app from before amounts keeps the amount in the title.
    const taskId = await t.run((ctx) =>
      ctx.db.insert('tasks', {
        listId: groceries,
        title: '2 pak melk',
        done: false,
        createdBy: aliceId,
        order: 0,
      }),
    )
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId })
    expect((await staple(t, id))?.low).toBe(false)
  })

  test('checking off on a list that is not for groceries changes nothing', async () => {
    const { t, as, chores } = await seed()
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Wasmiddel' })
    await t.run((ctx) => ctx.db.patch(id, { low: true }))
    const taskId = await as.mutation(api.tasks.add, {
      groupSlug: SLUG,
      listId: chores,
      title: 'Wasmiddel',
    })
    await as.mutation(api.tasks.toggleDone, { groupSlug: SLUG, taskId })
    expect((await staple(t, id))?.low).toBe(true)
  })

  test('another Group can neither see nor change them', async () => {
    const { asBob, as } = await seed()
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Hagelslag' })
    await expect(
      asBob.query(api.groceryStaples.list, { groupSlug: SLUG }),
    ).rejects.toThrow()
    await expect(
      asBob.mutation(api.groceryStaples.setLow, { groupSlug: 'other', id, low: true }),
    ).rejects.toThrow('Staple not found')
    await expect(
      asBob.mutation(api.groceryStaples.remove, { groupSlug: 'other', id }),
    ).rejects.toThrow('Staple not found')
  })

  test('removing a staple leaves the grocery list alone', async () => {
    const { t, as, groceries } = await seed()
    const id = await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Toiletpapier' })
    await as.mutation(api.groceryStaples.setLow, { groupSlug: SLUG, id, low: true })
    await as.mutation(api.groceryStaples.remove, { groupSlug: SLUG, id })
    expect(await staple(t, id)).toBeNull()
    expect(await itemsOn(t, groceries)).toHaveLength(1)
  })

  test('deleting the Group deletes its staples', async () => {
    const { t, as, groupId } = await seed()
    await as.mutation(api.groceryStaples.add, { groupSlug: SLUG, name: 'Spaghetti' })
    await as.mutation(api.groups.deleteGroup, { groupId })
    const left = await t.run((ctx) =>
      ctx.db
        .query('groceryStaples')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    )
    expect(left).toEqual([])
  })
})

describe('migratePantryToStaples', () => {
  async function withPantry() {
    const seeded = await seed()
    await seeded.t.run(async (ctx) => {
      const rows = [
        { groupId: seeded.groupId, title: 'Rijst', quantity: '2 zakken', createdBy: seeded.aliceId },
        { groupId: seeded.groupId, title: 'Olijfolie', createdBy: seeded.aliceId },
        // The same thing twice, as typed by two people.
        { groupId: seeded.groupId, title: 'rijst ', createdBy: seeded.aliceId },
        { groupId: seeded.groupId, title: '   ', createdBy: seeded.aliceId },
        { groupId: seeded.otherGroup, title: 'Rijst', createdBy: seeded.bobId },
      ]
      for (const row of rows) await ctx.db.insert('pantryEntries', row)
    })
    return seeded
  }

  async function allStaples(t: Seeded['t']) {
    return await t.run((ctx) => ctx.db.query('groceryStaples').collect())
  }

  test('a dry run counts and writes nothing', async () => {
    const { t } = await withPantry()
    const result = await t.mutation(internal.maintenance.migratePantryToStaples, {})
    expect(result).toMatchObject({
      apply: false,
      scanned: 5,
      missing: 3,
      created: 0,
      unnamed: 1,
      more: false,
    })
    expect(await allStaples(t)).toEqual([])
  })

  test('applied, each Group gets its entries as staples in stock, once', async () => {
    const { t, groupId, otherGroup, aliceId } = await withPantry()
    const result = await t.mutation(internal.maintenance.migratePantryToStaples, {
      apply: true,
    })
    expect(result).toMatchObject({ scanned: 5, missing: 3, created: 3, more: false })
    const staples = await allStaples(t)
    const mine = staples
      .filter((row) => row.groupId === groupId)
      .map(({ name, key, low, note, aisle, createdBy }) => ({
        name,
        key,
        low,
        note,
        aisle,
        createdBy,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    expect(mine).toEqual([
      {
        name: 'Olijfolie',
        key: 'olijfoli',
        low: false,
        note: undefined,
        aisle: 'tins_sauces',
        createdBy: aliceId,
      },
      {
        name: 'Rijst',
        key: 'rijst',
        low: false,
        note: '2 zakken',
        aisle: 'pasta_world',
        createdBy: aliceId,
      },
    ])
    expect(staples.filter((row) => row.groupId === otherGroup)).toHaveLength(1)
    // The pantry rows stay for installed apps.
    expect(await t.run((ctx) => ctx.db.query('pantryEntries').collect())).toHaveLength(5)

    // A verification run finds nothing left, and re-applying adds nothing.
    expect(
      await t.mutation(internal.maintenance.migratePantryToStaples, {}),
    ).toMatchObject({ missing: 0 })
    await t.mutation(internal.maintenance.migratePantryToStaples, { apply: true })
    expect(await allStaples(t)).toHaveLength(3)
  })

  test('pages with a cursor, and a staple the Group already keeps wins', async () => {
    const { t, as } = await withPantry()
    const existing = await as.mutation(api.groceryStaples.add, {
      groupSlug: SLUG,
      name: 'Rijst',
    })
    await as.mutation(api.groceryStaples.setLow, {
      groupSlug: SLUG,
      id: existing,
      low: true,
    })
    let cursor: string | null = null
    let pages = 0
    let created = 0
    for (;;) {
      const page: { more: boolean; cursor: string; created: number } =
        await t.mutation(internal.maintenance.migratePantryToStaples, {
          apply: true,
          batch: 2,
          cursor,
        })
      pages++
      created += page.created
      if (!page.more) break
      cursor = page.cursor
    }
    expect(pages).toBe(3)
    expect(created).toBe(2)
    expect((await staple(t, existing))?.low).toBe(true)
  })

  test('the Pantry functions installed apps call keep working', async () => {
    const { as } = await withPantry()
    await as.mutation(api.kitchen.addPantryEntry, { groupSlug: SLUG, title: 'Komijn' })
    const pantry = await as.query(api.kitchen.pantry, { groupSlug: SLUG })
    expect(pantry.map((entry) => entry.title)).toContain('Komijn')
  })

  test('an entry added by an installed app after the first run is picked up next time', async () => {
    const { t, as } = await withPantry()
    await t.mutation(internal.maintenance.migratePantryToStaples, { apply: true })
    await as.mutation(api.kitchen.addPantryEntry, { groupSlug: SLUG, title: 'Komijn' })
    expect(
      await t.mutation(internal.maintenance.migratePantryToStaples, { apply: true }),
    ).toMatchObject({ created: 1 })
  })
})
