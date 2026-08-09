import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import {
  applyCatalog,
  applySample,
  ensureSeedUser,
  resetSample,
} from './lib/seed/apply'
import { SAMPLE_GROUP_NAME } from './lib/seed/sampleHousehold'
import { MAX_MEAL_SUGGESTIONS } from './lib/servings'

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
   * The add sheet's first screen has to *demonstrate* something in a preview
   * (#76). A diary in which everything appears exactly once ranks correctly and
   * still looks arbitrary, so the fixtures owe each meal a habit — and this is
   * the test that notices when an edit to them quietly takes one away.
   */
  test('gives each meal a habit the add sheet can open on', async () => {
    const t = testConvex()
    await buildSample(t)
    const today = new Date().toISOString().slice(0, 10)
    const asOwner = t.withIdentity({ subject: owner.clerkId })

    const breakfast = await asOwner.query(api.consumption.suggestionsForMeal, {
      date: today,
      meal: 'breakfast',
    })
    // Porridge and milk, most mornings — ahead of the toast, on count. They
    // are logged together every time, so which of the two leads is decided by
    // the last tie-break and is not worth asserting.
    expect(breakfast.foods.slice(0, 2).map((f) => f.name).sort()).toEqual([
      'Milk, semi-skimmed',
      'Oats, rolled',
    ])
    expect(breakfast.recipes[0].title).toBe('Overnight oats')

    const dinner = await asOwner.query(api.consumption.suggestionsForMeal, {
      date: today,
      meal: 'dinner',
    })
    // A different meal opens on different things, which is the whole point.
    expect(dinner.recipes[0].title).toBe('Chickpea and spinach curry')
    expect(dinner.recipes.map((r) => r.title)).not.toContain('Overnight oats')

    // And bounded: eight of each at most, however much has been logged.
    for (const suggestions of [breakfast, dinner]) {
      expect(suggestions.foods.length).toBeLessThanOrEqual(
        MAX_MEAL_SUGGESTIONS,
      )
      expect(suggestions.recipes.length).toBeLessThanOrEqual(
        MAX_MEAL_SUGGESTIONS,
      )
    }
  })
})
