import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  carol,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import { CONNECTED_APP_REFUSED } from './lib/connectedApps'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const user = (who: typeof alice) =>
      ctx.db.insert('users', {
        clerkId: who.subject,
        name: who.name,
        email: who.email,
      })
    const aliceId = await user(alice)
    const bobId = await user(bob)
    const carolId = await user(carol)
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
    await seedMember(ctx, home, aliceId, 'admin')
    await seedMember(ctx, home, bobId, 'member')
    await seedMember(ctx, other, carolId, 'admin')
    const recipe = (groupId: typeof home, title: string, prepMinutes: number) =>
      ctx.db.insert('recipes', {
        groupId,
        sharedGroupIds: [],
        createdByUserId: aliceId,
        title,
        ingredients: ['2 onions', 'Rice', ''],
        steps: [],
        tags: [],
        prepMinutes,
        servings: 2,
        nutrition: {},
        nutritionSource: 'manual',
      })
    const pasta = await recipe(home, 'Pasta pesto', 25)
    const tacos = await recipe(home, 'Tacos', 35)
    const foreign = await recipe(other, 'Foreign soup', 20)
    const toast = await ctx.db.insert('mealEntries', {
      groupId: home,
      title: 'Toast',
      prepMinutes: 5,
      createdBy: aliceId,
    })
    return { aliceId, bobId, carolId, home, other, pasta, tacos, foreign, toast }
  })
  return { t, ...ids }
}

const WEEK = { groupSlug: 'home', from: '2026-11-23', to: '2026-11-29' }

describe('mealPlan', () => {
  test('plans a meal per slot and reads the week with the live recipe', async () => {
    const { t, pasta, toast } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-28',
      slot: 'dinner',
      recipeId: pasta,
      servings: 3,
      note: '  restjes van maandag ',
    })
    await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-28',
      slot: 'lunch',
      mealEntryId: toast,
    })
    const week = await t.withIdentity(bob).query(api.mealPlan.week, WEEK)
    expect(week.meals.map((m) => [m.date, m.slot, m.title])).toEqual([
      ['2026-11-28', 'lunch', 'Toast'],
      ['2026-11-28', 'dinner', 'Pasta pesto'],
    ])
    expect(week.meals[1]).toMatchObject({ servings: 3, note: 'restjes van maandag' })
    expect(week.members.map((m) => m.name)).toEqual(['Alice', 'Bob'])
    expect(week.preferences.slots.lunch).toEqual({ enabled: true, days: [5, 6] })
  })

  test('refuses a second meal in a taken slot unless it replaces', async () => {
    const { t, pasta, tacos } = await seed()
    const as = t.withIdentity(alice)
    const plan = { groupSlug: 'home', date: '2026-11-24', slot: 'dinner' as const }
    await as.mutation(api.mealPlan.plan, { ...plan, recipeId: pasta, servings: 4 })
    await expect(
      as.mutation(api.mealPlan.plan, { ...plan, recipeId: tacos }),
    ).rejects.toThrow('That slot already has a meal')
    await as.mutation(api.mealPlan.plan, { ...plan, recipeId: tacos, replace: true })
    const week = await as.query(api.mealPlan.week, WEEK)
    expect(week.meals).toHaveLength(1)
    // The evening's servings stay with the replacement.
    expect(week.meals[0]).toMatchObject({ title: 'Tacos', servings: 4 })
  })

  test('refuses a recipe from another Group, a stranger, and eaters who are not Members', async () => {
    const { t, pasta, foreign, carolId } = await seed()
    const plan = { groupSlug: 'home', date: '2026-11-24', slot: 'dinner' as const }
    await expect(
      t.withIdentity(alice).mutation(api.mealPlan.plan, { ...plan, recipeId: foreign }),
    ).rejects.toThrow('Recipe not found')
    await expect(
      t.withIdentity(carol).mutation(api.mealPlan.plan, { ...plan, recipeId: pasta }),
    ).rejects.toThrow('Not a member')
    await expect(
      t.withIdentity(carol).query(api.mealPlan.week, WEEK),
    ).rejects.toThrow('Not a member')
    await expect(
      t.withIdentity(alice).mutation(api.mealPlan.plan, {
        ...plan,
        recipeId: pasta,
        eaterIds: [carolId],
      }),
    ).rejects.toThrow('That person is not in this Group')
  })

  test('moves into an empty slot and swaps with a taken one', async () => {
    const { t, pasta, tacos } = await seed()
    const as = t.withIdentity(alice)
    const monday = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-23',
      slot: 'dinner',
      recipeId: pasta,
    })
    await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-26',
      slot: 'dinner',
      recipeId: tacos,
    })
    expect(
      await as.mutation(api.mealPlan.move, {
        groupSlug: 'home',
        id: monday,
        date: '2026-11-24',
        slot: 'dinner',
      }),
    ).toEqual({ kind: 'move' })
    const swapped = await as.mutation(api.mealPlan.move, {
      groupSlug: 'home',
      id: monday,
      date: '2026-11-26',
      slot: 'dinner',
    })
    expect(swapped.kind).toBe('swap')
    const week = await as.query(api.mealPlan.week, WEEK)
    expect(week.meals.map((m) => [m.date, m.title])).toEqual([
      ['2026-11-24', 'Tacos'],
      ['2026-11-26', 'Pasta pesto'],
    ])
  })

  test('updates and clears servings, note and eaters; refuses another Group’s meal', async () => {
    const { t, pasta, bobId } = await seed()
    const as = t.withIdentity(alice)
    const id = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
    })
    await as.mutation(api.mealPlan.update, {
      groupSlug: 'home',
      id,
      servings: 2,
      eaterIds: [bobId, bobId],
      note: 'Daan eet bij oma',
    })
    let meal = (await as.query(api.mealPlan.week, WEEK)).meals[0]
    expect(meal).toMatchObject({ servings: 2, eaterIds: [bobId], note: 'Daan eet bij oma' })
    await expect(
      as.mutation(api.mealPlan.update, { groupSlug: 'home', id, servings: 0 }),
    ).rejects.toThrow('Servings is a whole number')
    await as.mutation(api.mealPlan.update, {
      groupSlug: 'home',
      id,
      servings: null,
      eaterIds: null,
      note: null,
    })
    meal = (await as.query(api.mealPlan.week, WEEK)).meals[0]
    expect(meal.servings).toBeUndefined()
    expect(meal.eaterIds).toBeUndefined()
    expect(meal.note).toBeUndefined()
    await expect(
      t.withIdentity(carol).mutation(api.mealPlan.remove, { groupSlug: 'other', id }),
    ).rejects.toThrow('Meal not found')
  })

  test('marks only evening events, with who they take', async () => {
    const { t, home, aliceId, bobId } = await seed()
    await t.run(async (ctx) => {
      const calendarId = await ctx.db.insert('calendars', {
        groupId: home,
        name: 'Family',
        source: 'local',
        createdBy: aliceId,
      })
      const event = (title: string, startMinutes?: number, allDay = false) =>
        ctx.db.insert('calendarEvents', {
          calendarId,
          title,
          date: '2026-11-25',
          startMinutes,
          endMinutes: startMinutes === undefined ? undefined : startMinutes + 60,
          allDay,
          assigneeIds: [bobId],
          createdBy: aliceId,
        })
      await event('Zwemles', 18 * 60)
      await event('Dentist', 9 * 60)
      await event('Birthday', undefined, true)
    })
    const week = await t.withIdentity(alice).query(api.mealPlan.week, WEEK)
    expect(week.events).toMatchObject([
      { title: 'Zwemles', startMinutes: 1080, assigneeIds: [bobId] },
    ])
  })

  test('puts a planned recipe on the grocery list once', async () => {
    const { t, home, aliceId, pasta } = await seed()
    const as = t.withIdentity(alice)
    const id = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
    })
    expect(
      await as.mutation(api.mealPlan.addToGroceries, { groupSlug: 'home', id }),
    ).toEqual({ status: 'no-list', added: 0 })
    const listId = await t.run(async (ctx) => {
      const listId = await ctx.db.insert('taskLists', {
        groupId: home,
        name: 'Boodschappen',
        provider: 'local',
        order: 0,
      })
      await ctx.db.patch(home, { groceryListId: listId })
      await ctx.db.insert('tasks', {
        listId,
        title: 'rice',
        done: false,
        createdBy: aliceId,
        order: 0,
      })
      return listId
    })
    expect(
      await as.mutation(api.mealPlan.addToGroceries, { groupSlug: 'home', id }),
    ).toEqual({ status: 'added', added: 1, listName: 'Boodschappen' })
    const titles = await t.run(async (ctx) =>
      (
        await ctx.db
          .query('tasks')
          .withIndex('by_list', (q) => q.eq('listId', listId))
          .collect()
      ).map((task) => task.title),
    )
    expect(titles).toEqual(['rice', '2 onions'])
  })

  test('a Member who leaves drops out of who eats along', async () => {
    const { t, home, pasta, aliceId, bobId } = await seed()
    const id = await t.withIdentity(alice).mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
      eaterIds: [aliceId, bobId],
    })
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, { groupId: home })
    const meal = await t.run(async (ctx) => await ctx.db.get(id))
    expect(meal?.eaterIds).toEqual([aliceId])
  })
  test('the week reads the Group’s meal preferences', async () => {
    const { t, bobId } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPreferences.setDislike, {
      groupSlug: 'home',
      dislike: 'koriander',
      on: true,
    })
    await as.mutation(api.mealPreferences.setAllergen, {
      groupSlug: 'home',
      allergen: 'peanuts',
      on: true,
    })
    await as.mutation(api.mealPreferences.setMemberDefault, {
      groupSlug: 'home',
      userId: bobId,
      eatsByDefault: false,
    })
    const week = await t.withIdentity(bob).query(api.mealPlan.week, WEEK)
    expect(week.preferences.dislikes).toEqual(['koriander'])
    expect(week.preferences.allergens).toEqual(['peanuts'])
    expect(week.preferences.defaultEaterIds).not.toContain(bobId)
  })
})

describe('mealPlan.weekIngredients', () => {
  test('the ingredients of each Recipe planned in the range, once, without quick meals or another Group’s', async () => {
    const { t, home, pasta, tacos, foreign, toast } = await seed()
    await t.run(async (ctx) => {
      const plan = (date: string, slot: 'dinner' | 'lunch', fields: object) =>
        ctx.db.insert('plannedDinners', { groupId: home, date, slot, title: 'x', ...fields })
      await plan('2026-11-23', 'dinner', { recipeId: pasta })
      await plan('2026-11-24', 'dinner', { recipeId: tacos })
      await plan('2026-11-25', 'lunch', { recipeId: pasta })
      await plan('2026-11-26', 'dinner', { mealEntryId: toast })
      // Not visible in this Group, and outside the range.
      await plan('2026-11-27', 'dinner', { recipeId: foreign })
      await plan('2026-11-30', 'dinner', { recipeId: tacos })
    })
    const recipes = await t
      .withIdentity(alice)
      .query(api.mealPlan.weekIngredients, WEEK)
    expect(recipes.map((recipe) => recipe.title).sort()).toEqual(['Pasta pesto', 'Tacos'])
    expect(recipes[0]).toMatchObject({ servings: 2, ingredients: ['2 onions', 'Rice', ''] })
  })

  test('another Group’s Member cannot read it', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(carol).query(api.mealPlan.weekIngredients, WEEK),
    ).rejects.toThrow()
  })
})

describe('phones from before meal slots', () => {
  test('setDinner, clearDinner and planner act on the dinner slot only', async () => {
    const { t, pasta, tacos, toast } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-28',
      slot: 'lunch',
      mealEntryId: toast,
    })
    // A day with a lunch: `.unique()` on the day would have thrown here.
    await as.mutation(api.kitchen.setDinner, {
      groupSlug: 'home',
      date: '2026-11-28',
      title: 'ignored',
      recipeId: pasta,
    })
    await as.mutation(api.kitchen.setDinner, {
      groupSlug: 'home',
      date: '2026-11-28',
      title: 'ignored',
      recipeId: tacos,
      quickLimit: 30,
    })
    let planner = await as.query(api.kitchen.planner, WEEK)
    expect(planner.dinners.map((d) => [d.title, d.slot])).toEqual([
      ['Tacos', 'dinner'],
    ])
    await as.mutation(api.kitchen.clearDinner, {
      groupSlug: 'home',
      date: '2026-11-28',
    })
    planner = await as.query(api.kitchen.planner, WEEK)
    expect(planner.dinners).toHaveLength(0)
    const week = await as.query(api.mealPlan.week, WEEK)
    expect(week.meals.map((m) => m.slot)).toEqual(['lunch'])
  })

  test('a row without a slot reads as dinner everywhere', async () => {
    const { t, home, pasta } = await seed()
    await t.run(async (ctx) =>
      ctx.db.insert('plannedDinners', {
        groupId: home,
        date: '2026-11-23',
        recipeId: pasta,
        title: 'Pasta pesto',
        prepMinutes: 25,
      }),
    )
    const as = t.withIdentity(alice)
    expect((await as.query(api.mealPlan.week, WEEK)).meals[0].slot).toBe('dinner')
    expect((await as.query(api.kitchen.planner, WEEK)).dinners).toHaveLength(1)
    await expect(
      as.mutation(api.mealPlan.plan, {
        groupSlug: 'home',
        date: '2026-11-23',
        slot: 'dinner',
        recipeId: pasta,
      }),
    ).rejects.toThrow('That slot already has a meal')
  })
  test('refuses another Group’s meal to move, and a backwards or long range', async () => {
    const { t, pasta } = await seed()
    const id = await t.withIdentity(alice).mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
    })
    await expect(
      t.withIdentity(carol).mutation(api.mealPlan.move, {
        groupSlug: 'other',
        id,
        date: '2026-11-25',
        slot: 'dinner',
      }),
    ).rejects.toThrow('Meal not found')
    const as = t.withIdentity(alice)
    await expect(
      as.query(api.mealPlan.week, { groupSlug: 'home', from: '2026-11-29', to: '2026-11-23' }),
    ).rejects.toThrow('Use a range of YYYY-MM-DD days')
    await expect(
      as.query(api.mealPlan.week, { groupSlug: 'home', from: '2026-11-01', to: '2026-12-03' }),
    ).rejects.toThrow('At most 31 days at once')
  })

  test('an old phone’s setDinner swaps the dinner and keeps its servings, note and eaters', async () => {
    const { t, pasta, tacos, aliceId } = await seed()
    const as = t.withIdentity(alice)
    const id = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
      servings: 6,
      note: 'Extra voor lunch',
      eaterIds: [aliceId],
    })
    await as.mutation(api.kitchen.setDinner, {
      groupSlug: 'home',
      date: '2026-11-24',
      title: 'Tacos',
      recipeId: tacos,
    })
    const meal = await t.run(async (ctx) => await ctx.db.get(id))
    expect(meal).toMatchObject({
      title: 'Tacos',
      slot: 'dinner',
      servings: 6,
      note: 'Extra voor lunch',
      eaterIds: [aliceId],
    })
  })

  test('Something else replaces the meal it names, even after a swap moved it', async () => {
    const { t, pasta, tacos, toast } = await seed()
    const as = t.withIdentity(alice)
    const plan = { groupSlug: 'home', slot: 'dinner' as const }
    const monday = await as.mutation(api.mealPlan.plan, {
      ...plan,
      date: '2026-11-23',
      recipeId: pasta,
    })
    await as.mutation(api.mealPlan.plan, {
      ...plan,
      date: '2026-11-25',
      recipeId: tacos,
    })
    // The sheet's move lands first: Pasta goes to Wednesday, Tacos to Monday.
    await as.mutation(api.mealPlan.move, {
      groupSlug: 'home',
      id: monday,
      date: '2026-11-25',
      slot: 'dinner',
    })
    // Pick still thinks Pasta is on Monday.
    await as.mutation(api.mealPlan.plan, {
      ...plan,
      date: '2026-11-23',
      mealEntryId: toast,
      replace: true,
      replaceId: monday,
    })
    const week = await as.query(api.mealPlan.week, WEEK)
    expect(week.meals.map((m) => [m.date, m.title])).toEqual([
      ['2026-11-23', 'Tacos'],
      ['2026-11-25', 'Toast'],
    ])
  })

  test('refuses to replace another Group’s meal by id and leaves it alone', async () => {
    const { t, foreign, pasta } = await seed()
    const theirs = await t.withIdentity(carol).mutation(api.mealPlan.plan, {
      groupSlug: 'other',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: foreign,
    })
    await expect(
      t.withIdentity(alice).mutation(api.mealPlan.plan, {
        groupSlug: 'home',
        date: '2026-11-24',
        slot: 'dinner',
        recipeId: pasta,
        replace: true,
        replaceId: theirs,
      }),
    ).rejects.toThrow('Meal not found')
    const week = await t
      .withIdentity(carol)
      .query(api.mealPlan.week, { ...WEEK, groupSlug: 'other' })
    expect(week.meals.map((m) => m.title)).toEqual(['Foreign soup'])
    expect(
      (await t.withIdentity(alice).query(api.mealPlan.week, WEEK)).meals,
    ).toEqual([])
  })

  test('undo cuts a recipe title longer than a meal title instead of refusing', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPlan.restore, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      title: `  ${'x'.repeat(230)}`,
    })
    const [meal] = (await as.query(api.mealPlan.week, WEEK)).meals
    expect(meal.title).toHaveLength(200)
  })

  test('a retry with the same idempotency key answers the first meal', async () => {
    const { t, pasta } = await seed()
    const as = t.withIdentity(alice)
    const args = {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner' as const,
      recipeId: pasta,
      idempotencyKey: 'plan-meal-key-1',
    }
    const first = await as.mutation(api.mealPlan.plan, args)
    expect(await as.mutation(api.mealPlan.plan, args)).toBe(first)
    expect((await as.query(api.mealPlan.week, WEEK)).meals).toHaveLength(1)
  })

  test('undo restores the snapshot when the recipe is gone and an eater left', async () => {
    const { t, home, pasta, aliceId, bobId } = await seed()
    const as = t.withIdentity(alice)
    const id = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner',
      recipeId: pasta,
      note: 'Extra basil',
      eaterIds: [aliceId, bobId],
    })
    const removed = await as.mutation(api.mealPlan.remove, { groupSlug: 'home', id })
    await t.run(async (ctx) => await ctx.db.delete(pasta))
    await t.withIdentity(bob).mutation(api.groups.leaveGroup, { groupId: home })
    await as.mutation(api.mealPlan.restore, { groupSlug: 'home', ...removed })
    const [meal] = (await as.query(api.mealPlan.week, WEEK)).meals
    expect(meal).toMatchObject({
      date: '2026-11-24',
      slot: 'dinner',
      title: 'Pasta pesto',
      prepMinutes: 25,
      note: 'Extra basil',
      eaterIds: [aliceId],
    })
    expect(meal.recipeId).toBeUndefined()
    await expect(
      as.mutation(api.mealPlan.restore, { groupSlug: 'home', ...removed }),
    ).rejects.toThrow('That slot already has a meal')
  })

  test('a meal that changes day drops its chosen eaters; a new slot keeps them', async () => {
    const { t, pasta, aliceId } = await seed()
    const as = t.withIdentity(alice)
    const id = await as.mutation(api.mealPlan.plan, {
      groupSlug: 'home',
      date: '2026-11-26',
      slot: 'dinner',
      recipeId: pasta,
      eaterIds: [aliceId],
    })
    const eaters = async () =>
      (await t.run(async (ctx) => await ctx.db.get(id)))?.eaterIds
    await as.mutation(api.mealPlan.move, {
      groupSlug: 'home',
      id,
      date: '2026-11-26',
      slot: 'lunch',
    })
    expect(await eaters()).toEqual([aliceId])
    await as.mutation(api.mealPlan.move, {
      groupSlug: 'home',
      id,
      date: '2026-11-23',
      slot: 'lunch',
    })
    expect(await eaters()).toBeUndefined()
  })

  test('a swap across days drops both meals’ chosen eaters', async () => {
    const { t, pasta, tacos, aliceId, bobId } = await seed()
    const as = t.withIdentity(alice)
    const plan = { groupSlug: 'home', slot: 'dinner' as const }
    const monday = await as.mutation(api.mealPlan.plan, {
      ...plan,
      date: '2026-11-23',
      recipeId: pasta,
      eaterIds: [aliceId],
    })
    const thursday = await as.mutation(api.mealPlan.plan, {
      ...plan,
      date: '2026-11-26',
      recipeId: tacos,
      eaterIds: [bobId],
    })
    await as.mutation(api.mealPlan.move, {
      ...plan,
      id: monday,
      date: '2026-11-26',
    })
    const [a, b] = await t.run(
      async (ctx) => await Promise.all([ctx.db.get(monday), ctx.db.get(thursday)]),
    )
    expect([a?.date, a?.eaterIds, b?.date, b?.eaterIds]).toEqual([
      '2026-11-26',
      undefined,
      '2026-11-23',
      undefined,
    ])
  })

  test('a keyed replace answers its first meal on retry and changes nothing', async () => {
    const { t, pasta, tacos, toast } = await seed()
    const as = t.withIdentity(alice)
    const slot = {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner' as const,
    }
    const id = await as.mutation(api.mealPlan.plan, { ...slot, recipeId: pasta })
    const replace = {
      ...slot,
      recipeId: tacos,
      replace: true,
      idempotencyKey: 'replace-key-1',
    }
    expect(await as.mutation(api.mealPlan.plan, replace)).toBe(id)
    // Someone changes it meanwhile; the retry must not write over that.
    await as.mutation(api.mealPlan.plan, { ...slot, mealEntryId: toast, replace: true })
    expect(await as.mutation(api.mealPlan.plan, replace)).toBe(id)
    const [meal] = (await as.query(api.mealPlan.week, WEEK)).meals
    expect(meal.title).toBe('Toast')
  })

  test('undo is the app’s own: it refuses a connected app and cleans what it puts back', async () => {
    const { t, aliceId } = await seed()
    const snapshot = {
      groupSlug: 'home',
      date: '2026-11-24',
      slot: 'dinner' as const,
      title: 'Soup',
    }
    const app = t.withIdentity({
      ...alice,
      client_id: 'mcp-client',
      scope: 'gather:read gather:write',
    })
    await expect(app.mutation(api.mealPlan.restore, snapshot)).rejects.toThrow(
      CONNECTED_APP_REFUSED,
    )
    const as = t.withIdentity(alice)
    await as.mutation(api.mealPlan.restore, {
      ...snapshot,
      prepMinutes: -5,
      eaterIds: [aliceId, aliceId],
    })
    const [meal] = (await as.query(api.mealPlan.week, WEEK)).meals
    expect(meal.prepMinutes).toBeUndefined()
    expect(meal.eaterIds).toEqual([aliceId])
  })

  test('a day lists breakfast, lunch, then dinner', async () => {
    const { t, pasta, tacos, toast } = await seed()
    const as = t.withIdentity(alice)
    const at = { groupSlug: 'home', date: '2026-11-28' }
    await as.mutation(api.mealPlan.plan, { ...at, slot: 'dinner', recipeId: pasta })
    await as.mutation(api.mealPlan.plan, { ...at, slot: 'lunch', recipeId: tacos })
    await as.mutation(api.mealPlan.plan, { ...at, slot: 'breakfast', mealEntryId: toast })
    const week = await as.query(api.mealPlan.week, WEEK)
    expect(week.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'dinner'])
  })
})

describe('backfillMealSlots', () => {
  test('dry by default, then gives every old row the dinner slot once', async () => {
    const { t, home, pasta, toast } = await seed()
    await t.run(async (ctx) => {
      for (const date of ['2026-11-01', '2026-11-02'])
        await ctx.db.insert('plannedDinners', {
          groupId: home,
          date,
          recipeId: pasta,
          title: 'Pasta pesto',
          quickLimit: 20,
        })
      await ctx.db.insert('plannedDinners', {
        groupId: home,
        date: '2026-11-02',
        slot: 'lunch',
        mealEntryId: toast,
        title: 'Toast',
      })
    })
    const slots = () =>
      t.run(async (ctx) =>
        (await ctx.db.query('plannedDinners').collect()).map(
          (row) => row.slot ?? null,
        ),
      )
    expect(
      await t.mutation(internal.maintenance.backfillMealSlots, {}),
    ).toMatchObject({ apply: false, scanned: 3, missing: 2, more: false })
    expect(await slots()).toEqual([null, null, 'lunch'])
    await t.mutation(internal.maintenance.backfillMealSlots, { apply: true })
    expect(await slots()).toEqual(['dinner', 'dinner', 'lunch'])
    expect(
      await t.mutation(internal.maintenance.backfillMealSlots, {}),
    ).toMatchObject({ missing: 0, more: false })
    // The legacy field stays readable.
    const legacy = await t.run(async (ctx) =>
      (await ctx.db.query('plannedDinners').collect()).map(
        (r) => r.quickLimit ?? null,
      ),
    )
    expect(legacy).toEqual([20, 20, null])
  })

  test('pages by cursor until more is false', async () => {
    const { t, home, pasta } = await seed()
    await t.run(async (ctx) => {
      for (const date of ['2026-11-01', '2026-11-02', '2026-11-03'])
        await ctx.db.insert('plannedDinners', {
          groupId: home,
          date,
          recipeId: pasta,
          title: 'Pasta pesto',
        })
    })
    const first = await t.mutation(internal.maintenance.backfillMealSlots, {
      apply: true,
      batch: 2,
    })
    expect(first).toMatchObject({ scanned: 2, missing: 2, more: true })
    const second = await t.mutation(internal.maintenance.backfillMealSlots, {
      apply: true,
      batch: 2,
      cursor: first.cursor,
    })
    expect(second).toMatchObject({ scanned: 1, missing: 1, more: false })
    expect(
      await t.mutation(internal.maintenance.backfillMealSlots, {}),
    ).toMatchObject({ scanned: 3, missing: 0, more: false })
  })
})
