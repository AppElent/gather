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
    const asBob = t.withIdentity(bob)
    for (const allergen of ['peanuts', 'milk'] as const)
      await asBob.mutation(api.mealPreferences.setAllergen, {
        groupSlug: 'home',
        allergen,
        on: true,
      })
    for (const dislike of [' champignons ', 'Champignons'])
      await asBob.mutation(api.mealPreferences.setDislike, {
        groupSlug: 'home',
        dislike,
        on: true,
      })
    await asBob.mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: {
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
    await as.mutation(api.mealPreferences.setDiet, {
      groupSlug: 'home',
      diet: 'vegetarian',
      on: true,
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
      t.withIdentity(carol).mutation(api.mealPreferences.setDiet, {
        groupSlug: 'home',
        diet: 'vegan',
        on: true,
      }),
    ).rejects.toThrow('Not a member of that group')
    expect(await rowOf(t, home)).toBeNull()
  })
})

describe('safety lists change one item at a time', () => {
  test('two Members adding two allergens at once both keep theirs', async () => {
    const { t } = await seed()
    // Both read the same empty list before either write lands: a whole-list
    // write would drop one of these.
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setAllergen, {
        groupSlug: 'home',
        allergen: 'peanuts',
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setAllergen, {
        groupSlug: 'home',
        allergen: 'milk',
        on: true,
      }),
    ])
    const prefs = await t
      .withIdentity(alice)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect([...prefs.allergens].sort()).toEqual(['milk', 'peanuts'])
  })

  test('interleaved: one adds a diet while the other removes another', async () => {
    const { t } = await seed()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    await asAlice.mutation(api.mealPreferences.setDiet, {
      groupSlug: 'home',
      diet: 'vegetarian',
      on: true,
    })
    await Promise.all([
      asBob.mutation(api.mealPreferences.setDiet, {
        groupSlug: 'home',
        diet: 'halal',
        on: true,
      }),
      asAlice.mutation(api.mealPreferences.setDiet, {
        groupSlug: 'home',
        diet: 'vegetarian',
        on: false,
      }),
    ])
    const prefs = await asBob.query(api.mealPreferences.get, {
      groupSlug: 'home',
    })
    expect(prefs.diets).toEqual(['halal'])
  })

  test('two dislikes added at once both stay; removing ignores case', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setDislike, {
        groupSlug: 'home',
        dislike: 'koriander',
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setDislike, {
        groupSlug: 'home',
        dislike: 'Spruitjes',
        on: true,
      }),
    ])
    await t.withIdentity(bob).mutation(api.mealPreferences.setDislike, {
      groupSlug: 'home',
      dislike: 'KORIANDER',
      on: false,
    })
    const prefs = await t
      .withIdentity(alice)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(prefs.dislikes).toEqual(['Spruitjes'])
  })

  test('switching on twice keeps one; a too-long dislike is refused', async () => {
    const { t, home } = await seed()
    const as = t.withIdentity(alice)
    for (let i = 0; i < 2; i++)
      await as.mutation(api.mealPreferences.setAllergen, {
        groupSlug: 'home',
        allergen: 'eggs',
        on: true,
      })
    expect((await rowOf(t, home))?.allergens).toEqual(['eggs'])
    await expect(
      as.mutation(api.mealPreferences.setDislike, {
        groupSlug: 'home',
        dislike: 'x'.repeat(41),
        on: true,
      }),
    ).rejects.toMatchObject({
      data: { kind: 'mealPreferences:invalid', field: 'dislikes' },
    })
  })

  test('the whole-patch write no longer takes the safety lists', async () => {
    const { t, home } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.mealPreferences.update, {
        groupSlug: 'home',
        // @ts-expect-error allergens change one item at a time
        patch: { allergens: ['milk'] },
      }),
    ).rejects.toThrow()
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
    await t.withIdentity(alice).mutation(api.mealPreferences.setAllergen, {
      groupSlug: 'home',
      allergen: 'nuts',
      on: true,
    })
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, { groupId: home })
    await t.withIdentity(alice).mutation(api.groups.deleteGroup, { groupId: home })
    expect(await rowOf(t, home)).toBeNull()
  })

  test('another Group’s row is untouched and never read', async () => {
    const { t, other } = await seed()
    await t.withIdentity(carol).mutation(api.mealPreferences.setDiet, {
      groupSlug: 'other',
      diet: 'halal',
      on: true,
    })
    const home = await t
      .withIdentity(alice)
      .query(api.mealPreferences.get, { groupSlug: 'home' })
    expect(home.diets).toEqual([])
    expect((await rowOf(t, other))?.diets).toEqual(['halal'])
  })
})

describe('mealPreferences: per-item lists (APP-446)', () => {
  const prefsOf = (t: Harness, who: typeof alice) =>
    t.withIdentity(who).query(api.mealPreferences.get, { groupSlug: 'home' })

  test('two cuisines added at once both stay', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setCuisine, {
        groupSlug: 'home',
        cuisine: 'italian',
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setCuisine, {
        groupSlug: 'home',
        cuisine: 'indian',
        on: true,
      }),
    ])
    expect([...(await prefsOf(t, alice)).cuisines].sort()).toEqual([
      'indian',
      'italian',
    ])
  })

  test('fish and leftover days: two at once both stay, days stay Monday first', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setFishDay, {
        groupSlug: 'home',
        day: 4,
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setFishDay, {
        groupSlug: 'home',
        day: 1,
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setLeftoverDay, {
        groupSlug: 'home',
        day: 6,
        on: true,
      }),
      t.withIdentity(alice).mutation(api.mealPreferences.setLeftoverDay, {
        groupSlug: 'home',
        day: 2,
        on: true,
      }),
    ])
    const prefs = await prefsOf(t, alice)
    expect(prefs.fishDays).toEqual([1, 4])
    expect(prefs.leftoverDays).toEqual([2, 6])
    await t.withIdentity(bob).mutation(api.mealPreferences.setFishDay, {
      groupSlug: 'home',
      day: 1,
      on: false,
    })
    expect((await prefsOf(t, alice)).fishDays).toEqual([4])
  })

  test('a slot: another Member’s day and switch on a different slot survive', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setSlotEnabled, {
        groupSlug: 'home',
        slot: 'breakfast',
        on: true,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setSlotDay, {
        groupSlug: 'home',
        slot: 'lunch',
        day: 2,
        on: true,
      }),
      t.withIdentity(alice).mutation(api.mealPreferences.setSlotDay, {
        groupSlug: 'home',
        slot: 'dinner',
        day: 0,
        on: false,
      }),
    ])
    const { slots } = await prefsOf(t, bob)
    expect(slots.breakfast.enabled).toBe(true)
    expect(slots.lunch.days).toEqual([2, 5, 6])
    expect(slots.dinner.days).toEqual([1, 2, 3, 4, 5, 6])
    expect(slots.dinner.enabled).toBe(true)
  })

  test('switching on twice keeps one; an outsider is refused', async () => {
    const { t } = await seed()
    for (let i = 0; i < 2; i++)
      await t.withIdentity(alice).mutation(api.mealPreferences.setCuisine, {
        groupSlug: 'home',
        cuisine: 'dutch',
        on: true,
      })
    expect((await prefsOf(t, alice)).cuisines).toEqual(['dutch'])
    await expect(
      t.withIdentity(carol).mutation(api.mealPreferences.setCuisine, {
        groupSlug: 'home',
        cuisine: 'dutch',
        on: false,
      }),
    ).rejects.toThrow()
  })

  test('the whole-list `update` still works for a phone from before', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: {
        cuisines: ['asian'],
        fishDays: [3],
        leftoverDays: [0],
        slots: {
          breakfast: { enabled: true, days: [0] },
          lunch: { enabled: false, days: [] },
          dinner: { enabled: true, days: [1, 2] },
        },
      },
    })
    const prefs = await prefsOf(t, bob)
    expect(prefs.cuisines).toEqual(['asian'])
    expect(prefs.fishDays).toEqual([3])
    expect(prefs.leftoverDays).toEqual([0])
    expect(prefs.slots.dinner.days).toEqual([1, 2])
  })
})

describe('mealPreferences: cooking minutes and smart switches per field (APP-573)', () => {
  const prefsOf = (t: Harness, who: typeof alice) =>
    t.withIdentity(who).query(api.mealPreferences.get, { groupSlug: 'home' })

  test('two Members changing two days at once both keep theirs', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setCookingMinutes, {
        groupSlug: 'home',
        day: 0,
        minutes: 15,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setCookingMinutes, {
        groupSlug: 'home',
        day: 5,
        minutes: null,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setCookingMinutes, {
        groupSlug: 'home',
        day: 3,
        minutes: 90,
      }),
    ])
    expect((await prefsOf(t, alice)).cookingMinutes).toEqual([
      15, 30, 30, 90, 30, null, 60,
    ])
  })

  test('two Members flipping two smart switches at once both keep theirs', async () => {
    const { t } = await seed()
    await Promise.all([
      t.withIdentity(alice).mutation(api.mealPreferences.setSmartSwitch, {
        groupSlug: 'home',
        key: 'useStock',
        on: false,
      }),
      t.withIdentity(bob).mutation(api.mealPreferences.setSmartSwitch, {
        groupSlug: 'home',
        key: 'preferHighRated',
        on: false,
      }),
    ])
    expect((await prefsOf(t, bob)).smart).toEqual({
      useStock: false,
      useCalendar: true,
      preferHighRated: false,
    })
  })

  test('an outsider is refused and writes nothing', async () => {
    const { t, home } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.mealPreferences.setCookingMinutes, {
        groupSlug: 'home',
        day: 1,
        minutes: 15,
      }),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      t.withIdentity(carol).mutation(api.mealPreferences.setSmartSwitch, {
        groupSlug: 'home',
        key: 'useStock',
        on: false,
      }),
    ).rejects.toThrow('Not a member of that group')
    expect(await rowOf(t, home)).toBeNull()
  })

  test('the whole-value `update` still works for a phone from before', async () => {
    const { t } = await seed()
    await t.withIdentity(alice).mutation(api.mealPreferences.update, {
      groupSlug: 'home',
      patch: {
        cookingMinutes: [20, 20, 20, 20, 20, 45, null],
        smart: { useStock: false, useCalendar: false, preferHighRated: true },
      },
    })
    await t.withIdentity(bob).mutation(api.mealPreferences.setCookingMinutes, {
      groupSlug: 'home',
      day: 1,
      minutes: 60,
    })
    const prefs = await prefsOf(t, bob)
    expect(prefs.cookingMinutes).toEqual([20, 60, 20, 20, 20, 45, null])
    expect(prefs.smart).toEqual({
      useStock: false,
      useCalendar: false,
      preferHighRated: true,
    })
  })
})
