import { describe, expect, test } from 'vitest'
import { alice, bob, carol, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { recipesVisibleIn } from './lib/recipeShares'


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
    const carolId = await ctx.db.insert('users', {
      clerkId: carol.subject,
      name: carol.name,
      email: carol.email,
    })
    const home = await seedGroup(ctx, {
      name: 'Home',
      slug: 'home',
      inviteCode: 'home',
    })
    const other = await seedGroup(ctx, {
      name: 'Other',
      slug: 'other',
      inviteCode: 'other',
    })
    for (const userId of [aliceId, bobId])
      await seedMember(ctx, home, userId, 'member')
    await seedMember(ctx, other, aliceId, 'admin')
    const recipe = await ctx.db.insert('recipes', {
      groupId: home,
      sharedGroupIds: [],
      createdByUserId: aliceId,
      title: 'Roast vegetables',
      ingredients: [],
      steps: [],
      tags: [],
      prepMinutes: 35,
      servings: 2,
      nutrition: {},
      nutritionSource: 'manual',
    })
    return { home, other, recipe, carolId }
  })
  return { t, ...ids }
}

describe('planned dinners', () => {
  test('refuses a dinner with a Recipe from another Group', async () => {
    const { t, recipe } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.mealPlan.plan, {
        groupSlug: 'other',
        date: '2026-08-31',
        slot: 'dinner',
        recipeId: recipe,
      }),
    ).rejects.toThrow('Recipe not found')
  })

  test('refuses a non-member before exposing a dinner', async () => {
    const { t, recipe } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.mealPlan.plan, {
        groupSlug: 'home',
        date: '2026-08-31',
        slot: 'dinner',
        recipeId: recipe,
      }),
    ).rejects.toThrow('Not a member')
    await expect(
      t.withIdentity(carol).query(api.kitchen.overview, { groupSlug: 'home' }),
    ).rejects.toThrow('Not a member')
  })

  test('uses a Recipe’s current fields and keeps the stored snapshot after deletion', async () => {
    const { t, recipe } = await seed()
    await t.withIdentity(alice).mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-08-31',
      slot: 'dinner',
      recipeId: recipe,
    })
    await t.run(
      async (ctx) =>
        await ctx.db.patch(recipe, { title: 'Summer roast', prepMinutes: 20 }),
    )
    let overview = await t
      .withIdentity(bob)
      .query(api.kitchen.overview, { groupSlug: 'home' })
    expect(overview.dinners[0]).toMatchObject({
      title: 'Summer roast',
      prepMinutes: 20,
    })
    await t.run(async (ctx) => await ctx.db.delete(recipe))
    overview = await t
      .withIdentity(bob)
      .query(api.kitchen.overview, { groupSlug: 'home' })
    expect(overview.dinners[0]).toMatchObject({
      title: 'Roast vegetables',
      prepMinutes: 35,
    })
  })
})

/**
 * Home (Alice, Bob) and Other (Alice) from `seed`, plus a Stranger Group only
 * Carol is in, with a recipe nobody in Home can see. Other's recipe is Shared
 * into Home the way the app does it, through `recipes.share`.
 */
async function seedWithShares() {
  const base = await seed()
  const ids = await base.t.run(async (ctx) => {
    const stranger = await seedGroup(ctx, { name: 'Stranger', slug: 'stranger' })
    await seedMember(ctx, stranger, base.carolId, 'admin')
    const aliceId = (await ctx.db.get(base.recipe))?.createdByUserId
    if (!aliceId) throw new Error('seed recipe missing')
    const recipe = (groupId: Id<'groups'>, title: string) =>
      ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: aliceId,
        title,
        ingredients: [],
        steps: [],
        tags: [],
        prepMinutes: 20,
        servings: 2,
        nutrition: {},
        nutritionSource: 'manual',
      })
    return {
      stranger,
      sharedIn: await recipe(base.other, 'Shared curry'),
      strangers: await recipe(stranger, 'Stranger stew'),
    }
  })
  await base.t.withIdentity(alice).mutation(api.recipes.share, {
    id: ids.sharedIn,
    withGroupSlug: 'home',
  })
  return { ...base, ...ids }
}

const titlesOf = (rows: { title: string }[]) =>
  rows.map((row) => row.title).sort()

describe('reading recipes by index (APP-299)', () => {
  test('overview offers the Group’s own and shared-in recipes, never an unrelated Group’s', async () => {
    const { t } = await seedWithShares()
    const overview = await t
      .withIdentity(bob)
      .query(api.kitchen.overview, { groupSlug: 'home' })
    expect(titlesOf(overview.recipes)).toEqual(['Roast vegetables', 'Shared curry'])
  })

  test('a recipe of an unrelated Group is never read', async () => {
    const { t, home, strangers, recipe, sharedIn } = await seedWithShares()
    const read = new Set<string>()
    const recipes = await t.run(async (ctx) =>
      recipesVisibleIn(
        { ...ctx, db: recordingDb(ctx.db, read) } as unknown as QueryCtx,
        home,
      ),
    )
    expect(recipes.map((r) => r._id).sort()).toEqual([recipe, sharedIn].sort())
    expect(read.has(strangers)).toBe(false)
  })

  test('a share row that outlived its Share shows nothing', async () => {
    const { t, home, strangers } = await seedWithShares()
    await t.run(async (ctx) => {
      await ctx.db.insert('recipeShares', { recipeId: strangers, groupId: home })
    })
    const overview = await t
      .withIdentity(bob)
      .query(api.kitchen.overview, { groupSlug: 'home' })
    expect(titlesOf(overview.recipes)).not.toContain('Stranger stew')
  })

  test('unshare, move and delete keep the share rows in step', async () => {
    const { t, home, other, sharedIn } = await seedWithShares()
    const rows = () =>
      t.run(async (ctx) =>
        (await ctx.db.query('recipeShares').collect()).map((row) => ({
          recipeId: row.recipeId,
          groupId: row.groupId,
        })),
      )
    expect(await rows()).toEqual([{ recipeId: sharedIn, groupId: home }])

    await t.withIdentity(alice).mutation(api.recipes.unshare, {
      id: sharedIn,
      withGroupSlug: 'home',
    })
    expect(await rows()).toEqual([])

    await t.withIdentity(alice).mutation(api.recipes.share, {
      id: sharedIn,
      withGroupSlug: 'home',
    })
    // Moving it into the Group it was Shared into makes that its home.
    await t.withIdentity(alice).mutation(api.recipes.move, {
      id: sharedIn,
      toGroupSlug: 'home',
    })
    expect(await rows()).toEqual([])

    await t.withIdentity(alice).mutation(api.recipes.share, {
      id: sharedIn,
      withGroupSlug: 'other',
    })
    expect(await rows()).toEqual([{ recipeId: sharedIn, groupId: other }])
    await t.withIdentity(alice).mutation(api.recipes.remove, { id: sharedIn })
    expect(await rows()).toEqual([])
  })
})

describe('date ranges and the smaller queries (APP-299)', () => {
  async function withWeek() {
    const base = await seedWithShares()
    for (const date of ['2026-08-30', '2026-08-31', '2026-09-06', '2026-09-07'])
      await base.t.withIdentity(alice).mutation(api.mealPlan.plan, {
        groupSlug: 'home',
        date,
        slot: 'dinner',
        recipeId: base.sharedIn,
      })
    await base.t.run(async (ctx) => {
      const createdBy = (await ctx.db.get(base.recipe))?.createdByUserId
      if (!createdBy) throw new Error('seed recipe missing')
      const calendarId = await ctx.db.insert('calendars', {
        groupId: base.home,
        name: 'Family',
        source: 'local',
        createdBy,
      })
      for (const date of ['2026-08-30', '2026-09-01', '2026-09-07'])
        await ctx.db.insert('calendarEvents', {
          calendarId,
          title: `Event ${date}`,
          date,
          createdBy,
        })
    })
    return base
  }

  test('overview returns only the week asked for, dinners only', async () => {
    const { t, sharedIn } = await withWeek()
    const week = { groupSlug: 'home', from: '2026-08-31', to: '2026-09-06' }
    // A phone from before slots would draw this lunch as the day's dinner.
    await t.withIdentity(alice).mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-09-01',
      slot: 'lunch',
      recipeId: sharedIn,
    })
    const overview = await t.withIdentity(bob).query(api.kitchen.overview, week)
    expect(overview.dinners.map((d) => d.date)).toEqual(['2026-08-31', '2026-09-06'])
    // A live, Shared-in Recipe still titles its dinner.
    expect(overview.dinners[0]).toMatchObject({ title: 'Shared curry', prepMinutes: 20 })
    expect(overview.events.map((e) => e.date)).toEqual(['2026-09-01'])
  })

  test('overview keeps its result shape and reads everything without a range', async () => {
    const { t } = await withWeek()
    const overview = await t
      .withIdentity(bob)
      .query(api.kitchen.overview, { groupSlug: 'home' })
    expect(Object.keys(overview).sort()).toEqual([
      'calendars',
      'dinners',
      'events',
      'groceryListId',
      'hiddenCalendarIds',
      'mealEntries',
      'pantry',
      'recipes',
    ])
    expect(overview.dinners).toHaveLength(4)
    expect(overview.events).toHaveLength(3)
  })

  test('pantry and groceries return only what their screens show', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.kitchen.addPantryEntry, {
      groupSlug: 'home',
      title: 'Rice',
    })
    await t.withIdentity(alice).mutation(api.kitchen.addPantryEntry, {
      groupSlug: 'home',
      title: 'Beans',
    })
    const pantry = await t
      .withIdentity(bob)
      .query(api.kitchen.pantry, { groupSlug: 'home' })
    expect(pantry.map((p) => p.title)).toEqual(['Beans', 'Rice'])
    expect(
      await t.withIdentity(bob).query(api.kitchen.groceries, { groupSlug: 'home' }),
    ).toEqual({ groceryListId: null })
    await expect(
      t.withIdentity(carol).query(api.kitchen.pantry, { groupSlug: 'home' }),
    ).rejects.toThrow('Not a member')
    await expect(
      t.withIdentity(carol).query(api.kitchen.groceries, { groupSlug: 'home' }),
    ).rejects.toThrow('Not a member')
  })
})

/**
 * `ctx.db` that records the id of every document it hands back, for the reads
 * `recipesVisibleIn` makes (`get`, and `query().withIndex().collect()`).
 */
function recordingDb(db: QueryCtx['db'], read: Set<string>) {
  type Builder = {
    withIndex: (...args: unknown[]) => Builder
    collect: () => Promise<{ _id: string }[]>
  }
  const wrap = (builder: Builder): Builder => ({
    withIndex: (...args) => wrap(builder.withIndex(...args)),
    collect: async () => {
      const rows = await builder.collect()
      for (const row of rows) read.add(row._id)
      return rows
    },
  })
  return {
    get: async (id: Id<'recipes'>) => {
      const doc = await db.get(id)
      if (doc) read.add(doc._id)
      return doc
    },
    query: (table: 'recipes' | 'recipeShares') =>
      wrap(db.query(table) as unknown as Builder),
  }
}
