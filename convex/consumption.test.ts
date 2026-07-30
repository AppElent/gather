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
