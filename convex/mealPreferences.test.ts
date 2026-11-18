import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Meal preferences are Group content: every Member reads and changes them,
 * anybody else is refused before learning anything, a bad value is refused
 * by name, and the row goes with the Group.
 */

type Harness = ReturnType<typeof testConvex>

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const insertUser = (who: typeof alice) =>
      ctx.db.insert('users', {
        clerkId: who.subject,
        name: who.name,
        email: who.email,
      })
    const aliceId = await insertUser(alice)
    const bobId = await insertUser(bob)
    const carolId = await insertUser(carol)
    const home = await seedGroup(ctx, { name: 'Home', slug: 'home' })
    const other = await seedGroup(ctx, { name: 'Other', slug: 'other' })
    await seedMember(ctx, home, aliceId, 'admin')
    await seedMember(ctx, home, bobId, 'member')
    await seedMember(ctx, other, carolId, 'admin')
    return { home, other, aliceId, bobId, carolId }
  })
  return { t, ...ids }
}

const rowOf = (t: Harness, groupId: Id<'groups'>) =>
  t.run((ctx) =>
    ctx.db
      .query('mealPreferences')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .unique(),
  )

describe('mealPreferences.get', () => {
  test('answers the defaults and the Members when there is no row', async () => {
    const { t, aliceId, bobId } = await seed()
    const prefs = await t
      .withIdentity(bob)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(prefs.members).toEqual([
      { userId: aliceId, name: 'Alice' },
      { userId: bobId, name: 'Bob' },
    ])
    expect(prefs.defaultEaterIds).toEqual([aliceId, bobId])
    expect(prefs.servingsPerMeal).toBe(2)
    expect(prefs.slots.lunch).toEqual({ enabled: true, days: [5, 6] })
    expect(prefs.cookingMinutes).toEqual([30, 30, 30, 30, 30, 60, 60])
    expect(prefs.updatedAt).toBeNull()
  })

  test('refuses a non-member and an unknown Group, differently', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(carol).query(api.mealPreferences.get, { groupSlug: 'home' }),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      t.withIdentity(carol).query(api.mealPreferences.get, { groupSlug: 'nope' }),
    ).rejects.toThrow('No group has that slug')
    await expect(
      t.query(api.mealPreferences.get, { groupSlug: 'home' }),
    ).rejects.toThrow()
  })
})

describe('mealPreferences.update', () => {
  test('any Member changes it, the other reads it at once', async () => {
    const { t, home, bobId } = await seed()
    await t.withIdentity(bob).mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: {
        allergens: ['peanuts', 'milk'],
        dislikes: [' champignons ', 'Champignons'],
        cookingMinutes: [20, 20, 20, 20, 20, 60, null],
        fishDays: [4],
        weeklyBudgetCents: 8550,
      },
    })
    const seen = await t
      .withIdentity(alice)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(seen.allergens).toEqual(['peanuts', 'milk'])
    expect(seen.dislikes).toEqual(['champignons'])
    expect(seen.cookingMinutes[6]).toBeNull()
    expect(seen.fishDays).toEqual([4])
    expect(seen.weeklyBudgetCents).toBe(8550)
    expect((await rowOf(t, home))?.updatedBy).toBe(bobId)
  })

  test('one row per Group, patched in place', async () => {
    const { t, home } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: { diets: ['vegetarian'] },
    })
    await as.mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: { meatFreeNights: 2 },
    })
    const rows = await t.run((ctx) =>
      ctx.db
        .query('mealPreferences')
        .withIndex('by_group', (q) => q.eq('groupId', home))
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ diets: ['vegetarian'], meatFreeNights: 2 })
  })

  test('null clears the servings override and the budget', async () => {
    const { t, home } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: { servingsPerMeal: 5, weeklyBudgetCents: 9000 },
    })
    await as.mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: { servingsPerMeal: null, weeklyBudgetCents: null },
    })
    const row = await rowOf(t, home)
    expect(row?.servingsPerMeal).toBeUndefined()
    expect(row?.weeklyBudgetCents).toBeUndefined()
    const prefs = await as.query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(prefs.servingsPerMeal).toBe(2)
    expect(prefs.weeklyBudgetCents).toBeNull()
  })

  test('refuses an out-of-bounds value by field, and writes nothing', async () => {
    const { t, home } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.mealPreferences.update, {
        groupSlug: 'home',
        patch: { meatFreeNights: 9 },
      }),
    ).rejects.toMatchObject({
      data: { kind: 'mealPreferences:invalid', field: 'meatFreeNights' },
    })
    expect(await rowOf(t, home)).toBeNull()
  })

  test('refuses a non-member before writing', async () => {
    const { t, home } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.mealPreferences.update, {
        groupSlug: 'home',
        patch: { diets: ['vegan'] },
      }),
    ).rejects.toThrow('Not a member of that group')
    expect(await rowOf(t, home)).toBeNull()
  })
})

describe('mealPreferences.setMemberDefault', () => {
  test('sets one Member, keeps the others', async () => {
    const { t, aliceId, bobId } = await seed()
    await t.withIdentity(alice).mutation(api.mealPreferences.setMemberDefault, {
      groupSlug: 'home',
      userId: bobId,
      eatsByDefault: false,
    })
    const prefs = await t
      .withIdentity(bob)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(prefs.memberDefaults).toEqual([
      { userId: aliceId, eatsByDefault: true },
      { userId: bobId, eatsByDefault: false },
    ])
    expect(prefs.defaultEaterIds).toEqual([aliceId])
    expect(prefs.servingsPerMeal).toBe(1)
  })

  test('somebody outside the Group is refused as an invalid value', async () => {
    const { t, home, carolId } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.mealPreferences.setMemberDefault, {
        groupSlug: 'home',
        userId: carolId,
        eatsByDefault: false,
      }),
    ).rejects.toMatchObject({
      data: { kind: 'mealPreferences:invalid', field: 'memberDefault' },
    })
    expect(await rowOf(t, home)).toBeNull()
  })

  test('leaving the Group drops that Member’s default', async () => {
    const { t, home, bobId } = await seed()
    await t.withIdentity(alice).mutation(api.mealPreferences.setMemberDefault, {
      groupSlug: 'home',
      userId: bobId,
      eatsByDefault: false,
    })
    await t
      .withIdentity(bob)
      .mutation(api.groups.leaveGroup, { groupId: home })
    expect((await rowOf(t, home))?.memberDefaults).toEqual([
      expect.objectContaining({ eatsByDefault: true }),
    ])
  })
})

describe('the row goes with its Group', () => {
  test('deleting the Group deletes its meal preferences', async () => {
    const { t, home } = await seed()
    await t.withIdentity(alice).mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: { allergens: ['nuts'] },
    })
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, { groupId: home })
    await t.withIdentity(alice).mutation(api.groups.deleteGroup, { groupId: home })
    expect(await rowOf(t, home)).toBeNull()
  })

  test('another Group’s row is untouched and never read', async () => {
    const { t, other } = await seed()
    await t.withIdentity(carol).mutation(api.mealPreferences.update, {
      groupSlug: 'other',
      patch: { diets: ['halal'] },
    })
    const home = await t
      .withIdentity(alice)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(home.diets).toEqual([])
    expect((await rowOf(t, other))?.diets).toEqual(['halal'])
  })
})
