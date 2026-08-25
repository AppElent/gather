import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'

const alice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const bob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }
const carol = { subject: 'clerk_carol', name: 'Carol', email: 'c@example.com' }

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
    const home = await ctx.db.insert('groups', {
      name: 'Home',
      slug: 'home',
      isPersonal: false,
      inviteCode: 'home',
    })
    const other = await ctx.db.insert('groups', {
      name: 'Other',
      slug: 'other',
      isPersonal: false,
      inviteCode: 'other',
    })
    for (const userId of [aliceId, bobId])
      await ctx.db.insert('memberships', {
        groupId: home,
        userId,
        role: 'member',
      })
    await ctx.db.insert('memberships', {
      groupId: other,
      userId: aliceId,
      role: 'admin',
    })
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
      t.withIdentity(alice).mutation(api.kitchen.setDinner, {
        groupSlug: 'other',
        date: '2026-08-31',
        title: 'Forged',
        recipeId: recipe,
      }),
    ).rejects.toThrow('Recipe not found')
  })

  test('refuses a non-member before exposing a dinner', async () => {
    const { t, recipe } = await seed()
    await expect(
      t.withIdentity(carol).mutation(api.kitchen.setDinner, {
        groupSlug: 'home',
        date: '2026-08-31',
        title: 'Roast vegetables',
        recipeId: recipe,
      }),
    ).rejects.toThrow('Not a member')
    await expect(
      t.withIdentity(carol).query(api.kitchen.overview, { groupSlug: 'home' }),
    ).rejects.toThrow('Not a member')
  })

  test('uses a Recipe’s current fields and keeps the stored snapshot after deletion', async () => {
    const { t, recipe } = await seed()
    await t.withIdentity(alice).mutation(api.kitchen.setDinner, {
      groupSlug: 'home',
      date: '2026-08-31',
      title: 'Ignored client title',
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
