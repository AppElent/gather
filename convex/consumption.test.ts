import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

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
 * The emoji on a one-off (#94).
 *
 * A one-off has no `foodId` and no `recipeId`, so there is nothing behind it to
 * read a picture from and there never will be — this is the only picture it can
 * have. An entry logged without one is stored exactly as entries always were.
 */
describe('a one-off’s icon', () => {
  async function signedIn() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    return t
  }

  const oneOff = {
    date: DAY,
    meal: 'breakfast' as const,
    label: 'Poffertjes at the fair',
    quantity: 1,
    quantityUnit: 'piece' as const,
    nutrition: { calories: 400 },
  }

  test('is written with the entry and comes back on the day', async () => {
    const t = await signedIn()

    await t
      .withIdentity(asAlice)
      .mutation(api.consumption.create, { ...oneOff, icon: '🍬' })

    const entries = await t
      .withIdentity(asAlice)
      .query(api.consumption.listForDay, { date: DAY })
    expect(entries.map((e) => [e.label, e.icon])).toEqual([
      ['Poffertjes at the fair', '🍬'],
    ])
  })

  test('an entry logged without one has no field at all', async () => {
    const t = await signedIn()

    const id = await t
      .withIdentity(asAlice)
      .mutation(api.consumption.create, oneOff)

    const row = await t.run(async (ctx) => ctx.db.get(id))
    expect(row && 'icon' in row).toBe(false)
  })
})
