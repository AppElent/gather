import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Provenance under Group ownership (ADR-0003), through the real diary
 * functions.
 *
 * A diary entry is a Personal record that *snapshots* the recipe it was made
 * from. It stays readable forever — leaving a Group never erases your own
 * history — and the reference back to the recipe is permission-checked on read
 * and allowed to dangle.
 *
 * The rule these tests exist to hold down is the one that is easy to lose: a
 * recipe that was deleted and a recipe the caller can no longer see must be
 * treated identically, in rendering and in recompute alike. If they differ at
 * all, the diary becomes a way to find out that a recipe exists.
 */

const asAlice = { subject: 'clerk_alice' }
const asBob = { subject: 'clerk_bob' }

const DAY = '2026-07-30'

/** The recipe is 500 kcal per serving; the entry recorded 100. */
const RECIPE_PER_SERVING = { calories: 500 }
const SNAPSHOT = { calories: 100 }

/**
 * Alice and Bob share a household holding one recipe with nutrition, and Alice
 * has logged one serving of it — with a snapshot deliberately unlike the
 * recipe's current values, so that "recomputed from the recipe" and "scaled
 * from the snapshot" cannot be mistaken for one another.
 */
async function seed() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: 'alice@example.com',
    })
    const bob = await ctx.db.insert('users', {
      clerkId: 'clerk_bob',
      name: 'Bob',
      email: 'bob@example.com',
    })
    const household = await ctx.db.insert('groups', {
      name: 'Household',
      inviteCode: 'household-code',
      slug: 'household',
      isPersonal: false,
    })
    const aliceInHousehold = await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
    })

    const recipe = await ctx.db.insert('recipes', {
      groupId: household,
      sharedGroupIds: [],
      createdByUserId: alice,
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
      servings: 4,
      nutrition: RECIPE_PER_SERVING,
    })
    const entry = await ctx.db.insert('consumptionEntries', {
      userId: alice,
      date: DAY,
      meal: 'dinner',
      recipeId: recipe,
      label: 'Sunday roast',
      quantity: 1,
      quantityUnit: 'serving',
      nutrition: SNAPSHOT,
    })

    return { alice, household, aliceInHousehold, recipe, entry }
  })

  return { t, ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

/** The entry as Alice's diary shows it. */
async function entryAsShown(t: Seeded['t']) {
  const rows = await t
    .withIdentity(asAlice)
    .query(api.consumption.listForDay, { date: DAY })
  expect(rows).toHaveLength(1)
  return rows[0]
}

/**
 * The two ways a recipe stops being available to the diary that made an entry
 * from it. Everything downstream of this must be unable to tell them apart.
 */
const GONE = {
  deleted: async ({ t, ids }: Seeded) => {
    await t.run(async (ctx) => {
      await ctx.db.delete(ids.recipe)
    })
  },
  'no longer visible': async ({ t, ids }: Seeded) => {
    await t.run(async (ctx) => {
      await ctx.db.delete(ids.aliceInHousehold)
    })
  },
}

describe('a diary entry outlives the recipe it came from', () => {
  test('the link is there while the recipe is', async () => {
    const { t, ids } = await seed()
    const entry = await entryAsShown(t)
    expect(entry.recipeId).toBe(ids.recipe)
  })

  test.each(Object.keys(GONE))(
    'recorded values survive %s, and the link goes',
    async (how) => {
      const seeded = await seed()
      await GONE[how as keyof typeof GONE](seeded)

      const entry = await entryAsShown(seeded.t)

      expect(entry.label).toBe('Sunday roast')
      expect(entry.quantity).toBe(1)
      expect(entry.nutrition).toEqual(SNAPSHOT)
      expect(entry.recipeId).toBeUndefined()
    },
  )
})

describe('recomputing on a quantity change', () => {
  /** Double the quantity and report what the entry became. */
  async function doubleTheQuantity(seeded: Seeded) {
    await seeded.t
      .withIdentity(asAlice)
      .mutation(api.consumption.update, { id: seeded.ids.entry, quantity: 2 })
    const entry = await entryAsShown(seeded.t)
    return { quantity: entry.quantity, nutrition: entry.nutrition }
  }

  test('reads the recipe while it is visible', async () => {
    const seeded = await seed()
    // 500 kcal per serving, two servings — nothing to do with the snapshot.
    expect(await doubleTheQuantity(seeded)).toEqual({
      quantity: 2,
      nutrition: { calories: 1000 },
    })
  })

  test('treats deleted and no-longer-visible identically', async () => {
    const outcomes: Record<string, unknown> = {}
    for (const [how, makeItGone] of Object.entries(GONE)) {
      const seeded = await seed()
      await makeItGone(seeded)
      outcomes[how] = await doubleTheQuantity(seeded)
    }

    expect(outcomes.deleted).toEqual(outcomes['no longer visible'])
    // Both scale the snapshot rather than reading the recipe — which the
    // visible case above proves is a different answer, so this is not an
    // equality that holds by accident.
    expect(outcomes.deleted).toEqual({
      quantity: 2,
      nutrition: { calories: 200 },
    })
  })
})

/**
 * The same rule, driven by the two verbs that #25 adds rather than by deleting
 * a row or ending a membership.
 *
 * Nothing in `consumption.ts` knows that Move and Share exist, and that is the
 * claim being tested: a diary entry snapshots what it needs at write time
 * (ADR-0003), so the recorded values cannot move when the recipe does, and the
 * reference back to the recipe is permission-checked on read, so it simply
 * stops being returned the moment the reader can no longer see it. Both of
 * those are properties of code that was already there — these tests exist to
 * hold them down against a real move and a real unshare, because "the diary
 * broke when someone tidied up the recipes" is exactly the failure that would
 * otherwise be found by a household rather than by us.
 */
describe('a move or an unshare leaves the diary alone', () => {
  const CLUB_SNAPSHOT = { calories: 250 }

  /**
   * Alice and Bob share a household; Bob is also in a cooking club that Alice
   * has nothing to do with.
   *
   * Two recipes, one of each shape. The roast lives in the household and is
   * about to be moved into the club. The stew lives in the club and is shared
   * into the household, which is the only reason Alice can see it — until it is
   * unshared. Alice has logged one serving of each, so every assertion about
   * the one being taken away has the other beside it as a control.
   */
  async function seedTwoGroups() {
    const t = testConvex()

    const ids = await t.run(async (ctx) => {
      const alice = await ctx.db.insert('users', {
        clerkId: asAlice.subject,
        name: 'Alice',
        email: 'alice@example.com',
      })
      const bob = await ctx.db.insert('users', {
        clerkId: 'clerk_bob',
        name: 'Bob',
        email: 'bob@example.com',
      })
      const household = await ctx.db.insert('groups', {
        name: 'Household',
        inviteCode: 'household-code',
        slug: 'household',
        isPersonal: false,
      })
      const cookingClub = await ctx.db.insert('groups', {
        name: 'Cooking club',
        inviteCode: 'club-code',
        slug: 'cooking-club',
        isPersonal: false,
      })
      for (const [groupId, userId] of [
        [household, alice],
        [household, bob],
        [cookingClub, bob],
      ] as const) {
        await ctx.db.insert('memberships', { groupId, userId, role: 'admin' })
      }

      const roast = await ctx.db.insert('recipes', {
        groupId: household,
        sharedGroupIds: [],
        createdByUserId: alice,
        title: 'Sunday roast',
        ingredients: [],
        steps: [],
        tags: [],
        servings: 4,
        nutrition: RECIPE_PER_SERVING,
      })
      const stew = await ctx.db.insert('recipes', {
        groupId: cookingClub,
        sharedGroupIds: [household],
        createdByUserId: bob,
        title: 'Club stew',
        ingredients: [],
        steps: [],
        tags: [],
        servings: 4,
        nutrition: RECIPE_PER_SERVING,
      })

      await ctx.db.insert('consumptionEntries', {
        userId: alice,
        date: DAY,
        meal: 'dinner',
        recipeId: roast,
        label: 'Sunday roast',
        quantity: 1,
        quantityUnit: 'serving',
        nutrition: SNAPSHOT,
      })
      await ctx.db.insert('consumptionEntries', {
        userId: alice,
        date: DAY,
        meal: 'lunch',
        recipeId: stew,
        label: 'Club stew',
        quantity: 2,
        quantityUnit: 'serving',
        nutrition: CLUB_SNAPSHOT,
      })

      return { alice, bob, household, cookingClub, roast, stew }
    })

    return { t, ids }
  }

  type TwoGroups = Awaited<ReturnType<typeof seedTwoGroups>>

  /** Alice's whole day, keyed by what each entry recorded eating. */
  async function alicesDay(t: TwoGroups['t']) {
    const rows = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    expect(rows).toHaveLength(2)
    return Object.fromEntries(rows.map((row) => [row.label, row]))
  }

  /** Bob puts the roast in the club, where Alice cannot follow it. */
  async function moveTheRoastAway({ t, ids }: TwoGroups) {
    await t
      .withIdentity(asBob)
      .mutation(api.recipes.move, {
        id: ids.roast,
        toGroupSlug: 'cooking-club',
      })
  }

  /** Bob stops showing the household the club's stew. */
  async function unshareTheStew({ t, ids }: TwoGroups) {
    await t.withIdentity(asBob).mutation(api.recipes.unshare, {
      id: ids.stew,
      withGroupSlug: 'household',
    })
  }

  test('a move puts the recipe out of reach of the reader', async () => {
    const seeded = await seedTwoGroups()
    const before = await alicesDay(seeded.t)
    expect(before['Sunday roast'].recipeId).toBe(seeded.ids.roast)

    await moveTheRoastAway(seeded)

    const after = await alicesDay(seeded.t)
    // The entry is still there and still reads — that is criterion 6: the link
    // disappears rather than the page erroring.
    expect(after['Sunday roast'].recipeId).toBeUndefined()
    // And what it recorded is untouched, to the byte — criterion 5.
    expect(after['Sunday roast'].label).toBe('Sunday roast')
    expect(after['Sunday roast'].quantity).toBe(1)
    expect(after['Sunday roast'].nutrition).toEqual(SNAPSHOT)

    // The stew, which nothing happened to, still has its link. Without this the
    // test would pass just as well if `listForDay` had stopped returning any
    // recipe id at all.
    expect(after['Club stew'].recipeId).toBe(seeded.ids.stew)
  })

  test('an unshare puts the recipe out of reach of the reader', async () => {
    const seeded = await seedTwoGroups()
    const before = await alicesDay(seeded.t)
    expect(before['Club stew'].recipeId).toBe(seeded.ids.stew)

    await unshareTheStew(seeded)

    const after = await alicesDay(seeded.t)
    expect(after['Club stew'].recipeId).toBeUndefined()
    expect(after['Club stew'].label).toBe('Club stew')
    expect(after['Club stew'].quantity).toBe(2)
    expect(after['Club stew'].nutrition).toEqual(CLUB_SNAPSHOT)

    expect(after['Sunday roast'].recipeId).toBe(seeded.ids.roast)
  })

  /**
   * The stored rows, not the rendered ones. `listForDay` could be hiding a
   * rewrite by recomputing on read; this asserts that nothing wrote to the
   * entries at all.
   */
  test.each([
    ['a move', moveTheRoastAway],
    ['an unshare', unshareTheStew],
  ])('%s writes nothing to the stored entries', async (_name, act) => {
    const seeded = await seedTwoGroups()
    const storedEntries = async () =>
      await seeded.t.run(async (ctx) =>
        (await ctx.db.query('consumptionEntries').collect()).sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      )

    const before = await storedEntries()
    await act(seeded)
    expect(await storedEntries()).toEqual(before)
  })

  /**
   * Bob is in the club, so the move does not take the roast away from *him*.
   * Visibility is checked per reader on every read, and is not a property the
   * move stamped onto the entry.
   */
  test('a reader who can still see the recipe keeps the link', async () => {
    const seeded = await seedTwoGroups()
    const bobsEntry = await seeded.t.run(
      async (ctx) =>
        await ctx.db.insert('consumptionEntries', {
          userId: seeded.ids.bob,
          date: DAY,
          meal: 'dinner',
          recipeId: seeded.ids.roast,
          label: 'Sunday roast',
          quantity: 1,
          quantityUnit: 'serving',
          nutrition: SNAPSHOT,
        }),
    )

    await moveTheRoastAway(seeded)

    const bobsDay = await seeded.t
      .withIdentity(asBob)
      .query(api.consumption.listForDay, { date: DAY })
    expect(bobsDay.map((r) => r._id)).toEqual([bobsEntry])
    expect(bobsDay[0].recipeId).toBe(seeded.ids.roast)
  })
})

/**
 * Your own amounts, offered back to you.
 *
 * The third source of servings (#68), and the only one that reaches a Catalog
 * food — nobody may author a serving onto one (ADR-0004), so what a person has
 * actually logged is all there is to go on.
 */
describe('the amounts you have logged for a food', () => {
  async function withDiary(
    entries: Array<{ quantity: number; unit: 'g' | 'serving' }>,
  ) {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    await t.withIdentity(asBob).mutation(api.users.ensureUser, {})
    const foodId = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Hagelslag',
      baseUnit: 'g',
      nutritionPer100: { calories: 500 },
    })
    for (const [index, entry] of entries.entries()) {
      await t.withIdentity(asAlice).mutation(api.consumption.create, {
        date: DAY,
        meal: 'breakfast',
        foodId,
        label: `Hagelslag ${index}`,
        quantity: entry.quantity,
        quantityUnit: entry.unit,
        nutrition: { calories: 100 },
      })
    }
    return { t, foodId }
  }

  test('come back most-used first', async () => {
    const { t, foodId } = await withDiary([
      { quantity: 15, unit: 'g' },
      { quantity: 20, unit: 'g' },
      { quantity: 20, unit: 'g' },
    ])

    expect(
      await t
        .withIdentity(asAlice)
        .query(api.consumption.loggedAmountsForFood, { foodId }),
    ).toEqual([
      { label: '20 g', amount: 20 },
      { label: '15 g', amount: 15 },
    ])
  })

  test('are yours alone — somebody else’s diary is not consulted', async () => {
    const { t, foodId } = await withDiary([{ quantity: 15, unit: 'g' }])

    expect(
      await t
        .withIdentity(asBob)
        .query(api.consumption.loggedAmountsForFood, { foodId }),
    ).toEqual([])
  })

  test('are nothing at all without a session', async () => {
    const { t, foodId } = await withDiary([{ quantity: 15, unit: 'g' }])

    expect(
      await t.query(api.consumption.loggedAmountsForFood, { foodId }),
    ).toEqual([])
  })
})

/**
 * The first screen of the add sheet (#76).
 *
 * It used to show every recipe you owned and none of your foods. It shows what
 * you usually have at *this* meal now — read off your own diary, ranked by how
 * often, bounded at both ends — and everything else is behind the search box.
 */
describe('what the add sheet opens on', () => {
  /** Long enough before `DAY` to be outside the 60-day window. */
  const LAST_WINTER = '2026-01-04'

  async function withHabits() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    await t.withIdentity(asBob).mutation(api.users.ensureUser, {})

    const ids = await t.run(async (ctx) => {
      const alice = (await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
        .unique()) as { _id: Id<'users'> }
      const household = await ctx.db.insert('groups', {
        name: 'Household',
        inviteCode: 'household-code',
        slug: 'household',
        isPersonal: false,
      })
      const membership = await ctx.db.insert('memberships', {
        groupId: household,
        userId: alice._id,
        role: 'admin',
      })
      const recipe = (title: string) =>
        ctx.db.insert('recipes', {
          groupId: household,
          sharedGroupIds: [],
          createdByUserId: alice._id,
          title,
          ingredients: [],
          steps: [],
          tags: [],
          servings: 2,
          nutrition: RECIPE_PER_SERVING,
        })
      const food = (name: string) =>
        ctx.db.insert('foods', {
          name,
          searchText: name.toLowerCase(),
          baseUnit: 'g' as const,
          nutritionPer100: { calories: 100 },
          source: 'manual' as const,
        })
      return {
        alice: alice._id,
        membership,
        oats: await food('Porridge oats'),
        crisps: await food('Crisps'),
        pancakes: await food('Pancake mix'),
        overnightOats: await recipe('Overnight oats'),
        neverLogged: await recipe('Sunday roast'),
      }
    })

    /** A day's worth of the diary, written straight in so dates are chosen. */
    const logged = async (
      rows: Array<{
        date: string
        meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
        foodId?: Id<'foods'>
        recipeId?: Id<'recipes'>
        userId?: Id<'users'>
      }>,
    ) => {
      await t.run(async (ctx) => {
        for (const row of rows) {
          await ctx.db.insert('consumptionEntries', {
            userId: row.userId ?? ids.alice,
            date: row.date,
            meal: row.meal,
            foodId: row.foodId,
            recipeId: row.recipeId,
            label: 'Something',
            quantity: 1,
            quantityUnit: row.foodId ? 'g' : 'serving',
            nutrition: SNAPSHOT,
          })
        }
      })
    }

    return { t, ids, logged }
  }

  const opened = (t: Seeded['t'], meal: 'breakfast' | 'dinner' = 'breakfast') =>
    t
      .withIdentity(asAlice)
      .query(api.consumption.suggestionsForMeal, { date: DAY, meal })

  test('the food you have most often at this meal is first', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-28', meal: 'breakfast', foodId: ids.oats },
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
      { date: '2026-07-29', meal: 'snack', foodId: ids.crisps },
      { date: '2026-07-30', meal: 'breakfast', foodId: ids.pancakes },
    ])

    const { foods } = await opened(t)
    expect(foods.map((food) => food.name)).toEqual([
      'Porridge oats',
      'Pancake mix',
    ])
  })

  test('another meal’s habits are another meal’s', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
      { date: '2026-07-29', meal: 'dinner', foodId: ids.crisps },
    ])

    expect((await opened(t, 'dinner')).foods.map((f) => f.name)).toEqual([
      'Crisps',
    ])
  })

  test('a habit older than the window has stopped being the first guess', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: LAST_WINTER, meal: 'breakfast', foodId: ids.pancakes },
      { date: LAST_WINTER, meal: 'breakfast', foodId: ids.pancakes },
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
    ])

    expect((await opened(t)).foods.map((f) => f.name)).toEqual([
      'Porridge oats',
    ])
  })

  test('a recipe you have never logged is behind the search box', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-29', meal: 'breakfast', recipeId: ids.overnightOats },
    ])

    const { recipes } = await opened(t)
    expect(recipes.map((recipe) => recipe.title)).toEqual(['Overnight oats'])
  })

  test('a recipe you can no longer see is not offered back by your own history', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-29', meal: 'breakfast', recipeId: ids.overnightOats },
    ])
    await t.run(async (ctx) => {
      await ctx.db.delete(ids.membership)
    })

    expect((await opened(t)).recipes).toEqual([])
  })

  test('are yours alone — somebody else’s habits are not consulted', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
    ])

    expect(
      await t
        .withIdentity(asBob)
        .query(api.consumption.suggestionsForMeal, {
          date: DAY,
          meal: 'breakfast',
        }),
    ).toEqual({ foods: [], recipes: [] })
  })

  test('are nothing at all without a session', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
    ])

    expect(
      await t.query(api.consumption.suggestionsForMeal, {
        date: DAY,
        meal: 'breakfast',
      }),
    ).toEqual({ foods: [], recipes: [] })
  })

  /**
   * A row that cannot be offered must not cost a slot.
   *
   * Ranking is one thing and being loggable is another: a recipe that has been
   * deleted, or lost its nutrition, or moved out of a Group you are in, is
   * discovered only once the document is read. Cap the ranking first and those
   * discoveries come out of the eight — the sheet shows six, and the
   * ninth-ranked recipe, which is perfectly good, is never even fetched.
   */
  describe('a row that cannot be logged does not eat a slot', () => {
    /** Ten dinner recipes and nine dinner foods, strictly ordered by habit. */
    async function withTenHabits() {
      const t = testConvex()
      await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})

      const built = await t.run(async (ctx) => {
        const alice = (await ctx.db
          .query('users')
          .withIndex('by_clerkId', (q) => q.eq('clerkId', asAlice.subject))
          .unique()) as { _id: Id<'users'> }
        const household = await ctx.db.insert('groups', {
          name: 'Household',
          inviteCode: 'household-code',
          slug: 'household',
          isPersonal: false,
        })
        await ctx.db.insert('memberships', {
          groupId: household,
          userId: alice._id,
          role: 'admin',
        })

        const log = async (
          ref: { foodId?: Id<'foods'>; recipeId?: Id<'recipes'> },
          times: number,
        ) => {
          for (let n = 0; n < times; n += 1) {
            await ctx.db.insert('consumptionEntries', {
              userId: alice._id,
              date: '2026-07-20',
              meal: 'dinner',
              ...ref,
              label: 'Something',
              quantity: 1,
              quantityUnit: ref.foodId ? 'g' : 'serving',
              nutrition: SNAPSHOT,
            })
          }
        }

        const recipes: Id<'recipes'>[] = []
        for (let rank = 0; rank < 10; rank += 1) {
          const id = await ctx.db.insert('recipes', {
            groupId: household,
            sharedGroupIds: [],
            createdByUserId: alice._id,
            title: `Dinner ${rank}`,
            ingredients: [],
            steps: [],
            tags: [],
            servings: 2,
            nutrition: RECIPE_PER_SERVING,
          })
          recipes.push(id)
          await log({ recipeId: id }, 10 - rank)
        }

        const foods: Id<'foods'>[] = []
        for (let rank = 0; rank < 9; rank += 1) {
          const id = await ctx.db.insert('foods', {
            name: `Food ${rank}`,
            searchText: `food ${rank}`,
            baseUnit: 'g' as const,
            nutritionPer100: { calories: 100 },
            source: 'manual' as const,
          })
          foods.push(id)
          await log({ foodId: id }, 9 - rank)
        }

        return { recipes, foods }
      })

      return { t, ...built }
    }

    const dinner = (t: Seeded['t']) =>
      t
        .withIdentity(asAlice)
        .query(api.consumption.suggestionsForMeal, { date: DAY, meal: 'dinner' })

    test('the eight offered are the eight most-chosen usable recipes', async () => {
      const { t, recipes } = await withTenHabits()
      await t.run(async (ctx) => {
        // The most-chosen of all is gone, and the runner-up has lost the
        // nutrition a card is built from.
        await ctx.db.delete(recipes[0])
        await ctx.db.patch(recipes[1], { nutrition: undefined })
      })

      expect((await dinner(t)).recipes.map((r) => r.title)).toEqual([
        'Dinner 2',
        'Dinner 3',
        'Dinner 4',
        'Dinner 5',
        'Dinner 6',
        'Dinner 7',
        'Dinner 8',
        'Dinner 9',
      ])
    })

    test('a deleted food does not cost a slot either', async () => {
      const { t, foods } = await withTenHabits()
      await t.run(async (ctx) => {
        await ctx.db.delete(foods[0])
      })

      expect((await dinner(t)).foods.map((f) => f.name)).toEqual([
        'Food 1',
        'Food 2',
        'Food 3',
        'Food 4',
        'Food 5',
        'Food 6',
        'Food 7',
        'Food 8',
      ])
    })
  })

  test('a day after the one being logged is not a habit of it', async () => {
    // The window has two ends. Opening the sheet on a day last month must ask
    // about the habits of that month — and the scan takes the newest rows
    // first, so an unbounded top end does not merely skew the ranking, it can
    // spend the whole scan on entries written after the day being asked about.
    const { t, ids, logged } = await withHabits()
    await logged([
      { date: '2026-08-20', meal: 'breakfast', foodId: ids.pancakes },
      { date: '2026-08-21', meal: 'breakfast', foodId: ids.pancakes },
      { date: '2026-07-29', meal: 'breakfast', foodId: ids.oats },
    ])

    expect((await opened(t)).foods.map((f) => f.name)).toEqual([
      'Porridge oats',
    ])
  })

  test('the day being logged counts, so this morning is part of this morning', async () => {
    const { t, ids, logged } = await withHabits()
    await logged([{ date: DAY, meal: 'breakfast', foodId: ids.oats }])

    expect((await opened(t)).foods.map((f) => f.name)).toEqual([
      'Porridge oats',
    ])
  })
})
