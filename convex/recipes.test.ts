import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * The seam every later ticket in #15 is verified at: seed data, authenticate as
 * a specific person, call the *real* query, assert what comes back.
 *
 * Recipe visibility is the read path chosen to prove it, because it is the one
 * whose rule the rebuild is about to change — a recipe is currently visible to
 * its owner or to any Group it is shared into.
 */

async function seed() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: 'clerk_alice',
      name: 'Alice',
      email: 'alice@example.com',
    })
    const bob = await ctx.db.insert('users', {
      clerkId: 'clerk_bob',
      name: 'Bob',
      email: 'bob@example.com',
    })
    const carol = await ctx.db.insert('users', {
      clerkId: 'clerk_carol',
      name: 'Carol',
      email: 'carol@example.com',
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

    // Alice and Bob share the household; Carol is only in the cooking club.
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'admin',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
    })
    await ctx.db.insert('memberships', {
      groupId: cookingClub,
      userId: carol,
      role: 'admin',
    })

    const secret = await ctx.db.insert('recipes', {
      ownerId: alice,
      sharedGroupIds: [],
      title: 'Unshared draft',
      ingredients: [],
      steps: [],
      tags: [],
    })
    const shared = await ctx.db.insert('recipes', {
      ownerId: alice,
      sharedGroupIds: [household],
      title: 'Sunday roast',
      ingredients: [],
      steps: [],
      tags: [],
    })

    return { alice, bob, carol, household, cookingClub, secret, shared }
  })

  return { t, ids }
}

const asAlice = { subject: 'clerk_alice' }
const asBob = { subject: 'clerk_bob' }
const asCarol = { subject: 'clerk_carol' }

function titles(rows: Array<{ title: string }>) {
  return rows.map((r) => r.title).sort()
}

describe('recipes.list', () => {
  test('shows a person everything they own', async () => {
    const { t } = await seed()
    const rows = await t.withIdentity(asAlice).query(api.recipes.list, {})
    expect(titles(rows)).toEqual(['Sunday roast', 'Unshared draft'])
  })

  test('shows a fellow Group member only what is shared into it', async () => {
    const { t } = await seed()
    const rows = await t.withIdentity(asBob).query(api.recipes.list, {})
    expect(titles(rows)).toEqual(['Sunday roast'])
  })

  test('shows someone outside the Group nothing', async () => {
    const { t } = await seed()
    const rows = await t.withIdentity(asCarol).query(api.recipes.list, {})
    expect(rows).toEqual([])
  })

  test('shows a signed-out caller nothing', async () => {
    const { t } = await seed()
    const rows = await t.query(api.recipes.list, {})
    expect(rows).toEqual([])
  })
})

describe('recipes.get', () => {
  test('returns a recipe shared into a Group you belong to', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.shared })
    expect(recipe?.title).toBe('Sunday roast')
  })

  test('refuses a recipe not shared into any Group you belong to', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asBob)
      .query(api.recipes.get, { id: ids.secret })
    expect(recipe).toBeNull()
  })

  test('refuses someone outside the Group entirely', async () => {
    const { t, ids } = await seed()
    const recipe = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, { id: ids.shared })
    expect(recipe).toBeNull()
  })
})

describe('recipes.create', () => {
  test('records the caller as the recipe owner', async () => {
    const { t, ids } = await seed()
    const id: Id<'recipes'> = await t
      .withIdentity(asBob)
      .mutation(api.recipes.create, {
        title: 'Bob loaf',
        ingredients: ['flour'],
        steps: ['bake'],
        tags: [],
        sharedGroupIds: [ids.household],
      })

    const seenByAlice = await t
      .withIdentity(asAlice)
      .query(api.recipes.get, { id })
    expect(seenByAlice?.title).toBe('Bob loaf')

    const seenByCarol = await t
      .withIdentity(asCarol)
      .query(api.recipes.get, { id })
    expect(seenByCarol).toBeNull()
  })

  test('refuses an unauthenticated caller', async () => {
    const { t } = await seed()
    await expect(
      t.mutation(api.recipes.create, {
        title: 'Anonymous',
        ingredients: [],
        steps: [],
        tags: [],
      }),
    ).rejects.toThrow()
  })
})
