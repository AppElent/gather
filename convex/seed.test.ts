import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import {
  applyCatalog,
  applySample,
  ensureSeedUser,
  resetSample,
} from './lib/seed/apply'
import { SAMPLE_GROUP_NAME } from './lib/seed/sampleHousehold'

/**
 * The Sample household, built against the Group boundary.
 *
 * It arrived on `main` written for the schema this branch replaced: Groups
 * carried a `type` instead of a slug, the owner's membership was `'owner'`, and
 * a recipe carried an `ownerId` and was merely *shared* into a Group. None of
 * that conflicted textually with the rebuild — it simply stopped compiling, and
 * a shape error is the only part of that a compiler can catch.
 *
 * These cover the part it cannot: that the household it builds obeys the same
 * rules a real one does. Nothing tested it before, on either branch.
 */

const owner = { clerkId: 'clerk_owner', name: 'Owner', email: 'o@example.test' }

async function buildSample(t: ReturnType<typeof testConvex>) {
  return await t.run(async (ctx) => {
    // The sample diary references Catalog foods by `seedKey`, so the Catalog
    // has to exist first — the order both real entrypoints use.
    await applyCatalog(ctx)
    const ownerId = await ensureSeedUser(
      ctx,
      owner.clerkId,
      owner.name,
      owner.email,
    )
    await applySample(ctx, ownerId, Date.now())
    return ownerId
  })
}

async function sampleGroup(t: ReturnType<typeof testConvex>) {
  return await t.run(async (ctx) => {
    const groups = await ctx.db.query('groups').collect()
    return groups.find((g) => g.name === SAMPLE_GROUP_NAME) ?? null
  })
}

describe('the Sample household', () => {
  test('is an ordinary shared Group with a real address', async () => {
    const t = testConvex()
    await buildSample(t)

    const group = await sampleGroup(t)
    expect(group).not.toBeNull()
    expect(group?.isPersonal).toBe(false)
    // Allocated rather than hand-written, so it cannot collide with a Group
    // somebody actually made (ADR-0002).
    expect(group?.slug).toBeTruthy()
  })

  test('makes its owner an admin, and the housemates members', async () => {
    const t = testConvex()
    const ownerId = await buildSample(t)
    const group = await sampleGroup(t)

    const roles = await t.run(async (ctx) => {
      const memberships = await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', group?._id ?? ('' as never)))
        .collect()
      return memberships.map((m) => ({
        isOwner: m.userId === ownerId,
        role: m.role,
      }))
    })

    expect(roles.find((r) => r.isOwner)?.role).toBe('admin')
    expect(roles.filter((r) => !r.isOwner).every((r) => r.role === 'member')).toBe(
      true,
    )
    // The whole point of the housemates: somebody else's name in the stream.
    expect(roles.length).toBeGreaterThan(1)
  })

  /**
   * A recipe lives in a Group and records who added it; the two are different
   * facts (CONTEXT.md). The fixtures give recipes varied authors precisely so
   * Home's activity stream has more than one name in it — which only works if
   * the attribution is kept while the Group does the owning.
   */
  test('puts its recipes in the Group and attributes them to people', async () => {
    const t = testConvex()
    await buildSample(t)
    const group = await sampleGroup(t)

    const recipes = await t.run(async (ctx) => ctx.db.query('recipes').collect())

    expect(recipes.length).toBeGreaterThan(0)
    expect(recipes.every((r) => r.groupId === group?._id)).toBe(true)
    // Shared *into* nowhere else: it already lives where it belongs.
    expect(recipes.every((r) => r.sharedGroupIds.length === 0)).toBe(true)
    expect(new Set(recipes.map((r) => r.createdByUserId)).size).toBeGreaterThan(1)
  })

  test('takes its recipes with it when it is reset', async () => {
    const t = testConvex()
    await buildSample(t)

    await t.run(async (ctx) => await resetSample(ctx))

    const left = await t.run(async (ctx) => ({
      groups: (await ctx.db.query('groups').collect()).filter(
        (g) => g.name === SAMPLE_GROUP_NAME,
      ).length,
      // A recipe whose home Group has gone is reachable by nobody — the reset
      // used to keep it, back when a person owned it and a Group merely saw it.
      recipes: (await ctx.db.query('recipes').collect()).length,
    }))

    expect(left.groups).toBe(0)
    expect(left.recipes).toBe(0)
  })

  /**
   * A preview is where a distinction has to be visible before anything is
   * built on it (#87, and #86's AI routes after it). Where a food's *figures*
   * came from is invisible unless the sample contains foods that differ in
   * it — and it is only obviously a separate question from where the *row*
   * came from while at least one food answers the two differently.
   */
  test('contains foods carrying each answer about where their figures came from', async () => {
    const t = testConvex()
    await buildSample(t)

    const userFoods = await t.run(async (ctx) =>
      (await ctx.db.query('foods').collect()).filter(
        (f) => f.seedKey === undefined,
      ),
    )

    expect(new Set(userFoods.map((f) => f.nutritionSource))).toEqual(
      new Set(['imported', 'ai', 'manual']),
    )
    // A review of a seeded preview must demonstrate the icon fallback without
    // having to type a search first (#114).
    expect(userFoods.every((f) => f.icon !== undefined)).toBe(true)
    // Catalog foods claim nothing: their figures are authored (ADR 0004).
    const catalog = await t.run(async (ctx) =>
      (await ctx.db.query('foods').collect()).filter(
        (f) => f.seedKey !== undefined,
      ),
    )
    expect(catalog.every((f) => f.nutritionSource === undefined)).toBe(true)
    // The two questions, answered differently by the same row.
    expect(
      userFoods.some(
        (f) => f.source === 'manual' && f.nutritionSource === 'ai',
      ),
    ).toBe(true)
  })

  test('takes its user-created foods with it when it is reset', async () => {
    const t = testConvex()
    await buildSample(t)

    await t.run(async (ctx) => await resetSample(ctx))

    const left = await t.run(async (ctx) =>
      (await ctx.db.query('foods').collect()).filter(
        (f) => f.seedKey === undefined,
      ),
    )
    expect(left).toEqual([])
  })
})
