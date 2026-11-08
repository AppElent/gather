import { SAMPLE_GROUP_NAME } from '@gather/core/groups'
import { MODULES, type ModuleId } from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'
import { testConvex } from '../test/convexHarness'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import type { GroupScopedTable } from './lib/groupAccess'
import {
  applyCatalog,
  applySample,
  ensureSeedUser,
  resetSample,
} from './lib/seed/apply'

/**
 * The Sample household, built against the Group boundary.
 *
 * A compiler catches a shape error in the seed; these cover the part it
 * cannot: that the household it builds obeys the same rules a real one does.
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
  test('is an ordinary Group with an allocated slug', async () => {
    const t = testConvex()
    await buildSample(t)

    const group = await sampleGroup(t)
    expect(group).not.toBeNull()
    // Allocated rather than hand-written, so it cannot collide with a Group
    // somebody actually made.
    expect(group?.slug).toBe('willow-street')
  })

  test('makes its owner an admin, and the housemates members', async () => {
    const t = testConvex()
    const ownerId = await buildSample(t)
    const group = await sampleGroup(t)

    const roles = await t.run(async (ctx) => {
      const memberships = await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) =>
          q.eq('groupId', group?._id ?? ('' as never)),
        )
        .collect()
      return memberships.map((m) => ({
        isOwner: m.userId === ownerId,
        role: m.role,
      }))
    })

    expect(roles.find((r) => r.isOwner)?.role).toBe('admin')
    expect(
      roles.filter((r) => !r.isOwner).every((r) => r.role === 'member'),
    ).toBe(true)
    // The whole point of the housemates: somebody else's name in the stream.
    expect(roles.length).toBeGreaterThan(1)
  })

  /**
   * A recipe lives in a Group and records who added it; the two are different
   * facts (GLOSSARY.md). The fixtures give recipes varied authors precisely so
   * Home's activity stream has more than one name in it — which only works if
   * the attribution is kept while the Group does the owning.
   */
  test('puts its recipes in the Group and attributes them to people', async () => {
    const t = testConvex()
    await buildSample(t)
    const group = await sampleGroup(t)

    const recipes = await t.run(async (ctx) =>
      ctx.db.query('recipes').collect(),
    )

    expect(recipes.length).toBeGreaterThan(0)
    expect(recipes.every((r) => r.groupId === group?._id)).toBe(true)
    // Shared *into* nowhere else: it already lives where it belongs.
    expect(recipes.every((r) => r.sharedGroupIds.length === 0)).toBe(true)
    expect(new Set(recipes.map((r) => r.createdByUserId)).size).toBeGreaterThan(
      1,
    )
  })

  test('takes its recipes with it when it is reset', async () => {
    const t = testConvex()
    await buildSample(t)

    await t.run(async (ctx) => await resetSample(ctx))

    const left = await t.run(async (ctx) => ({
      groups: (await ctx.db.query('groups').collect()).filter(
        (g) => g.name === SAMPLE_GROUP_NAME,
      ).length,
      // A recipe whose home Group has gone is reachable by nobody, so the reset
      // takes it too.
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

  test('takes what the app added inside it with it when it is reset', async () => {
    const t = testConvex()
    const ownerId = await buildSample(t)
    const group = await sampleGroup(t)
    if (!group) throw new Error('no sample group')

    await t.run(async (ctx) => {
      await ctx.db.insert('notes', {
        groupId: group._id,
        title: 'Added later',
        body: '',
        createdBy: ownerId,
        updatedAt: 0,
      })
      await ctx.db.insert('recurringCosts', {
        groupId: group._id,
        createdByUserId: ownerId,
        order: 0,
        name: 'Added later',
        amountCents: 100,
        frequency: 'monthly',
        category: 'utilities',
      })
      await ctx.db.insert('netWorthEntries', {
        groupId: group._id,
        createdByUserId: ownerId,
        order: 0,
        label: 'Added later',
        kind: 'asset',
        amountCents: 100,
      })
    })

    await t.run(async (ctx) => await resetSample(ctx))

    const left = await t.run(async (ctx) => ({
      notes: await ctx.db.query('notes').collect(),
      costs: await ctx.db.query('recurringCosts').collect(),
      worth: await ctx.db.query('netWorthEntries').collect(),
    }))
    expect(left).toEqual({ notes: [], costs: [], worth: [] })
  })

  test('contains a representative immutable Shared costs scenario', async () => {
    const t = testConvex()
    await buildSample(t)

    const scenarios = await t.run(async (ctx) =>
      ctx.db.query('splitScenarios').collect(),
    )

    expect(scenarios).toHaveLength(1)
    expect(scenarios[0].payments).toHaveLength(2)
    expect(scenarios[0].participants).toHaveLength(3)
    expect(scenarios[0].transfers).toHaveLength(2)
    expect(scenarios[0].totalCents).toBe(450_00)
  })
})

/** The Sample household's rows that make one Module look used. */
type SampleContent = (
  ctx: MutationCtx,
  sample: { group: Doc<'groups'>; ownerId: Id<'users'> },
) => Promise<unknown[]>

async function groupRows(
  ctx: MutationCtx,
  table: GroupScopedTable,
  groupId: Id<'groups'>,
) {
  const rows: { groupId: Id<'groups'> }[] = await ctx.db.query(table).collect()
  return rows.filter((row) => row.groupId === groupId)
}

const inGroup =
  (table: GroupScopedTable): SampleContent =>
  (ctx, { group }) =>
    groupRows(ctx, table, group._id)

const subjectsOf =
  (kind: TastingKind): SampleContent =>
  async (ctx, { group }) =>
    (
      (await groupRows(
        ctx,
        'tastingSubjects',
        group._id,
      )) as Doc<'tastingSubjects'>[]
    ).filter((subject) => subject.kind === kind)

/**
 * Where each Module's sample content lives. Keyed by every Module, so a new
 * one fails `pnpm typecheck` here until it names its rows, and the test below
 * fails until the seed writes some.
 */
const SAMPLE_CONTENT: Record<ModuleId, SampleContent> = {
  recipes: inGroup('recipes'),
  // Personal: the diary belongs to the person the household is built around.
  nutrition: async (ctx, { ownerId }) =>
    (await ctx.db.query('consumptionEntries').collect()).filter(
      (entry) => entry.userId === ownerId,
    ),
  'meal-planner': inGroup('plannedDinners'),
  groceries: async (ctx, { group }) => {
    const listId = group.groceryListId
    if (!listId) return []
    return (await ctx.db.query('tasks').collect()).filter(
      (task) => task.listId === listId,
    )
  },
  pantry: inGroup('pantryEntries'),
  'recurring-costs': inGroup('recurringCosts'),
  'shared-costs': inGroup('splitScenarios'),
  'savings-goals': inGroup('savingsGoals'),
  tasks: inGroup('taskLists'),
  'baby-log': inGroup('babies'),
  calendar: inGroup('calendars'),
  notes: inGroup('notes'),
  cheeses: subjectsOf('cheese'),
  wines: subjectsOf('wine'),
  beers: subjectsOf('beer'),
}

describe('every Module in the Sample household', () => {
  test.each(MODULES.map((module) => module.id))(
    '%s has sample content',
    async (moduleId) => {
      const t = testConvex()
      const ownerId = await buildSample(t)
      const group = await sampleGroup(t)
      if (!group) throw new Error('no sample group')

      const rows = await t.run((ctx) =>
        SAMPLE_CONTENT[moduleId](ctx, { group, ownerId }),
      )
      expect(rows.length).toBeGreaterThan(0)
    },
  )
})
