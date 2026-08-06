import { convexTest } from 'convex-test'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { describe, expect, test } from 'vitest'
import { modules, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

/**
 * The backfill behind #17, tested against the data it actually has to repair.
 *
 * A migration is the one thing that cannot be tested on the current schema:
 * `groups` rows with no slug, no `isPersonal` and a stray `type`, and
 * memberships still called `owner`, are precisely what the schema stopped
 * allowing once the backfill had removed them. So this file builds its backend
 * on the *pre-migration* schema — the same tables, with those three fields as
 * they were — and runs the real internal mutation against it.
 *
 * Every other table is taken from the app's own schema, so this cannot drift
 * into testing a fictional database.
 */
const legacySchema = defineSchema({
  ...schema.tables,
  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    slug: v.optional(v.string()),
    isPersonal: v.optional(v.boolean()),
    type: v.optional(v.string()),
  })
    .index('by_inviteCode', ['inviteCode'])
    .index('by_slug', ['slug']),
  memberships: defineTable({
    groupId: v.id('groups'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member'), v.literal('owner')),
  })
    .index('by_user', ['userId'])
    .index('by_group', ['groupId']),
})

function legacyConvex() {
  return convexTest(legacySchema, modules)
}

type Harness = ReturnType<typeof legacyConvex>

const asAlice = { subject: 'clerk_alice', name: 'Alice', email: 'a@example.com' }
const asBob = { subject: 'clerk_bob', name: 'Bob', email: 'b@example.com' }

const backfill = internal.maintenance.backfillGroupSlugsAndPersonalGroups

/**
 * Rows exactly as they looked before this change: a `Home` group with no slug,
 * no `isPersonal` and a `type`, `owner` memberships, and Alice's
 * `defaultGroupId` pointing at her `Home` group. Bob is in the household only,
 * so he has no Personal group at all.
 */
async function seedLegacy(t: Harness) {
  return await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: asAlice.email,
    })
    const bob = await ctx.db.insert('users', {
      clerkId: asBob.subject,
      name: 'Bob',
      email: asBob.email,
    })
    const home = await ctx.db.insert('groups', {
      name: 'Home',
      inviteCode: 'home-code',
      type: 'home',
    })
    const household = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      inviteCode: 'household-code',
    })
    await ctx.db.insert('memberships', {
      groupId: home,
      userId: alice,
      role: 'owner',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'owner',
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: bob,
      role: 'member',
    })
    await ctx.db.patch(alice, { defaultGroupId: home })
    return { alice, bob, home, household }
  })
}

/** The whole visible state the backfill touches. */
async function rows(t: Harness) {
  return await t.run(async (ctx) => ({
    groups: (await ctx.db.query('groups').collect()).map((g) => ({
      name: g.name,
      // `t.run` returns through Convex's serialiser, which has no `undefined`.
      slug: g.slug ?? null,
      isPersonal: g.isPersonal ?? null,
      hasTypeField: 'type' in g,
    })),
    memberships: (await ctx.db.query('memberships').collect()).map(
      (m) => m.role,
    ),
    defaults: (await ctx.db.query('users').collect()).map(
      (u) => u.defaultGroupId ?? null,
    ),
  }))
}

/** The Personal group a person can see, through the real query. */
async function personalGroupOf(t: Harness, identity: typeof asAlice) {
  const groups = await t.withIdentity(identity).query(api.groups.myGroups, {})
  const personal = groups.filter((g) => g.isPersonal)
  expect(personal).toHaveLength(1)
  return personal[0]
}

describe('backfillGroupSlugsAndPersonalGroups', () => {
  test('changes nothing until asked to apply', async () => {
    const t = legacyConvex()
    await seedLegacy(t)
    const before = await rows(t)

    const summary = await t.mutation(backfill, {})

    expect(summary.apply).toBe(false)
    expect(summary).toMatchObject({
      slugsAssigned: 2,
      groupsMarkedPersonal: 1,
      groupsMarkedShared: 1,
      rolesMigrated: 2,
      droppedTypeFields: 1,
      personalGroupsCreated: 1,
    })
    expect(await rows(t)).toEqual(before)
  })

  test('gives every Group a slug and marks the Personal ones', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const after = await rows(t)
    expect(after.groups).toEqual(
      expect.arrayContaining([
        // A Personal group's slug reads from the person, not from "Home".
        { name: 'Home', slug: 'me-alice', isPersonal: true, hasTypeField: false },
        {
          name: 'Jansen Household',
          slug: 'jansen-household',
          isPersonal: false,
          hasTypeField: false,
        },
      ]),
    )
  })

  test('renames the owner role to admin', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const { memberships } = await rows(t)
    expect(memberships).not.toContain('owner')
    // Alice's two `owner` rows, Bob's `member` row, and the admin membership
    // of the Personal group Bob was given.
    expect(memberships.sort()).toEqual(['admin', 'admin', 'admin', 'member'])
  })

  test('drops the type field the tightened schema would reject', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const { groups } = await rows(t)
    expect(groups.some((g) => g.hasTypeField)).toBe(false)
  })

  test('gives a person with no Personal group one, as their default', async () => {
    const t = legacyConvex()
    await seedLegacy(t)

    await t.mutation(backfill, { apply: true })

    const personal = await personalGroupOf(t, asBob)
    expect(personal.name).toBe("Bob's things")
    expect(personal.slug).toBe('me-bob')
    const bob = await t.withIdentity(asBob).query(api.users.me, {})
    expect(bob?.defaultGroupId).toBe(personal._id)
  })

  test('leaves everything alone the second time it is applied', async () => {
    const t = legacyConvex()
    await seedLegacy(t)
    await t.mutation(backfill, { apply: true })
    const afterFirst = await rows(t)

    const summary = await t.mutation(backfill, { apply: true })

    expect(summary).toEqual({
      apply: true,
      rolesMigrated: 0,
      groupsMarkedPersonal: 0,
      groupsMarkedShared: 0,
      slugsAssigned: 0,
      droppedTypeFields: 0,
      personalGroupsCreated: 0,
      defaultGroupsRepointed: 0,
    })
    expect(await rows(t)).toEqual(afterFirst)
  })

  test('does not hand two Groups the same slug', async () => {
    const t = legacyConvex()
    await t.run(async (ctx) => {
      for (const inviteCode of ['a', 'b', 'c']) {
        await ctx.db.insert('groups', { name: 'Wine club', inviteCode })
      }
    })

    await t.mutation(backfill, { apply: true })

    const slugs = await t.run(
      async (ctx) =>
        (await ctx.db.query('groups').collect()).map((g) => g.slug ?? ''),
    )
    expect(slugs.sort()).toEqual(['wine-club', 'wine-club-2', 'wine-club-3'])
  })

  test('two people with the same name get distinct Personal slugs', async () => {
    const t = legacyConvex()
    await t.run(async (ctx) => {
      for (const clerkId of [asAlice.subject, asBob.subject]) {
        await ctx.db.insert('users', {
          clerkId,
          name: 'Alice',
          email: `${clerkId}@example.com`,
        })
      }
    })

    await t.mutation(backfill, { apply: true })

    const slugs = [
      (await personalGroupOf(t, asAlice)).slug,
      (await personalGroupOf(t, asBob)).slug,
    ]
    expect(slugs.sort()).toEqual(['me-alice', 'me-alice-2'])
  })
})

/**
 * The recipe wipe behind #19.
 *
 * Recipe data is disposable and is destroyed rather than migrated, so that the
 * new ownership fields can be required from the first commit. Diary entries are
 * the opposite: what they recorded is a snapshot and must come through
 * untouched, with only the provenance reference cleared (ADR-0003). That
 * asymmetry is the whole of what these tests check.
 */
const wipe = internal.maintenance.wipeRecipes

async function seedRecipesAndDiary() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const alice = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: asAlice.email,
    })
    const household = await ctx.db.insert('groups', {
      name: 'Household',
      inviteCode: 'household-code',
      slug: 'household',
      isPersonal: false,
    })
    await ctx.db.insert('memberships', {
      groupId: household,
      userId: alice,
      role: 'admin',
    })

    const recipe = async (title: string) =>
      await ctx.db.insert('recipes', {
        groupId: household,
        sharedGroupIds: [],
        createdByUserId: alice,
        title,
        ingredients: [],
        steps: [],
        tags: [],
      })
    const roast = await recipe('Sunday roast')
    await recipe('Pasta for a crowd')

    const fromRecipe = await ctx.db.insert('consumptionEntries', {
      userId: alice,
      date: '2026-07-30',
      meal: 'dinner',
      recipeId: roast,
      label: 'Sunday roast',
      quantity: 2,
      quantityUnit: 'serving',
      nutrition: { calories: 640, protein: 41 },
    })
    const typedIn = await ctx.db.insert('consumptionEntries', {
      userId: alice,
      date: '2026-07-30',
      meal: 'lunch',
      label: 'Sandwich',
      quantity: 1,
      quantityUnit: 'piece',
      nutrition: { calories: 300 },
    })

    return { fromRecipe, typedIn }
  })

  return { t, ids }
}

/** Everything the wipe is allowed — and not allowed — to change. */
async function diaryAndRecipes(t: ReturnType<typeof testConvex>) {
  return await t.run(async (ctx) => ({
    recipeTitles: (await ctx.db.query('recipes').collect()).map((r) => r.title),
    entries: (await ctx.db.query('consumptionEntries').collect()).map((e) => ({
      label: e.label,
      quantity: e.quantity,
      quantityUnit: e.quantityUnit,
      nutrition: e.nutrition,
      // `t.run` returns through Convex's serialiser, which has no `undefined`.
      recipeId: e.recipeId ?? null,
    })),
  }))
}

describe('wipeRecipes', () => {
  test('changes nothing until asked to apply', async () => {
    const { t } = await seedRecipesAndDiary()
    const before = await diaryAndRecipes(t)

    const summary = await t.mutation(wipe, {})

    expect(summary).toEqual({
      apply: false,
      recipesDeleted: 2,
      entriesUnlinked: 1,
    })
    expect(await diaryAndRecipes(t)).toEqual(before)
  })

  test('deletes every recipe and clears the references left dangling', async () => {
    const { t } = await seedRecipesAndDiary()

    const summary = await t.mutation(wipe, { apply: true })

    expect(summary).toEqual({
      apply: true,
      recipesDeleted: 2,
      entriesUnlinked: 1,
    })
    const after = await diaryAndRecipes(t)
    expect(after.recipeTitles).toEqual([])
    expect(after.entries.every((e) => e.recipeId === null)).toBe(true)
  })

  test('leaves what a diary entry recorded exactly as it was', async () => {
    const { t } = await seedRecipesAndDiary()
    const before = await diaryAndRecipes(t)

    await t.mutation(wipe, { apply: true })

    const after = await diaryAndRecipes(t)
    // The snapshot — label, quantity, unit, nutrition — is untouched for both
    // entries; only the one that pointed at a recipe lost its reference.
    expect(after.entries.map(({ recipeId: _, ...rest }) => rest)).toEqual(
      before.entries.map(({ recipeId: _, ...rest }) => rest),
    )
  })

  test('leaves everything alone the second time it is applied', async () => {
    const { t } = await seedRecipesAndDiary()
    await t.mutation(wipe, { apply: true })
    const afterFirst = await diaryAndRecipes(t)

    const summary = await t.mutation(wipe, { apply: true })

    expect(summary).toEqual({
      apply: true,
      recipesDeleted: 0,
      entriesUnlinked: 0,
    })
    expect(await diaryAndRecipes(t)).toEqual(afterFirst)
  })
})

/**
 * The baby log's move onto Group scope, behind #20.
 *
 * This is the one migration in the rebuild that touches data nobody can
 * re-enter, so the tests are written as the acceptance criteria are: every
 * baby and every event present afterwards, payloads and timestamps unchanged,
 * attribution intact, and a second run that neither duplicates nor corrupts
 * anything. See docs/migrations/0003-baby-log-onto-group-scope.md.
 */
const verify = internal.maintenance.verifyBabyLogScope
const moveBaby = internal.maintenance.moveBabyToGroup

/**
 * Where a child logged before #18 actually is: in Alice's Personal group,
 * because `babies.create` took the Group from `defaultGroupId` and #17 changed
 * what that meant. Bob is in the household with Alice but cannot see the child
 * from there — which is the whole problem this move fixes.
 */
async function seedBabyLog() {
  const t = testConvex()

  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: asAlice.subject,
      name: 'Alice',
      email: asAlice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: asBob.subject,
      name: 'Bob',
      email: asBob.email,
    })

    const meAlice = await ctx.db.insert('groups', {
      name: 'Alice things',
      inviteCode: 'me-alice-code',
      slug: 'me-alice',
      isPersonal: true,
    })
    const household = await ctx.db.insert('groups', {
      name: 'Jansen Household',
      inviteCode: 'jansen-code',
      slug: 'jansen-household',
      isPersonal: false,
    })
    await ctx.db.patch(aliceId, { defaultGroupId: meAlice })

    for (const [groupId, userId, role] of [
      [meAlice, aliceId, 'admin'],
      [household, aliceId, 'admin'],
      [household, bobId, 'member'],
    ] as const) {
      await ctx.db.insert('memberships', { groupId, userId, role })
    }

    const noor = await ctx.db.insert('babies', {
      groupId: meAlice,
      name: 'Noor',
      birthDate: '2026-01-05',
      order: 0,
    })
    const todos = await ctx.db.insert('taskLists', {
      groupId: meAlice,
      name: 'Noor to-dos',
      provider: 'local',
      order: 0,
    })
    const questions = await ctx.db.insert('taskLists', {
      groupId: meAlice,
      name: 'Noor questions',
      provider: 'local',
      order: 1,
    })
    await ctx.db.patch(noor, { taskListId: todos, questionsListId: questions })

    await ctx.db.insert('babyEvents', {
      babyId: noor,
      type: 'feeding',
      timestamp: 1_760_000_000_000,
      endTimestamp: 1_760_000_900_000,
      notes: 'took most of it',
      loggedBy: aliceId,
      data: { method: 'bottle', amountMl: 90 },
    })
    await ctx.db.insert('babyEvents', {
      babyId: noor,
      type: 'temperature',
      timestamp: 1_760_003_600_000,
      loggedBy: bobId,
      data: { celsius: 37.4, method: 'ear' },
    })
    await ctx.db.insert('babyEvents', {
      babyId: noor,
      type: 'diaper',
      timestamp: 1_760_007_200_000,
      loggedBy: bobId,
      data: { kind: 'both' },
    })

    return { aliceId, bobId, meAlice, household, noor, todos, questions }
  })

  return { t, ...ids }
}

/**
 * Everything about the log that the move is *not* allowed to change. `groupId`
 * is deliberately left out — it is the one field the move exists to write, and
 * it is asserted separately.
 */
async function logContents(t: ReturnType<typeof testConvex>) {
  return await t.run(async (ctx) => ({
    babies: (await ctx.db.query('babies').collect())
      .map((b) => ({
        id: b._id,
        name: b.name,
        birthDate: b.birthDate,
        order: b.order,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
    events: (await ctx.db.query('babyEvents').collect())
      .map((e) => ({
        id: e._id,
        babyId: e.babyId,
        type: e.type,
        timestamp: e.timestamp,
        // `t.run` returns through Convex's serialiser, which has no `undefined`.
        endTimestamp: e.endTimestamp ?? null,
        notes: e.notes ?? null,
        loggedBy: e.loggedBy,
        data: e.data,
      }))
      .sort((a, b) => a.timestamp - b.timestamp),
  }))
}

async function groupOfBaby(
  t: ReturnType<typeof testConvex>,
  babyId: Id<'babies'>,
) {
  return await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId)
    const group = baby ? await ctx.db.get(baby.groupId) : null
    return group?.slug ?? null
  })
}

describe('verifyBabyLogScope', () => {
  test('says where every child and every entry is, per Group', async () => {
    const { t } = await seedBabyLog()

    const report = await t.query(verify, {})

    expect(report.totals).toEqual({
      groups: 2,
      babies: 1,
      events: 3,
      eventsWithoutBaby: 0,
    })
    expect(report.groups).toEqual([
      {
        slug: 'jansen-household',
        isPersonal: false,
        members: 2,
        babies: 0,
        babyNames: [],
        events: 0,
      },
      {
        slug: 'me-alice',
        isPersonal: true,
        members: 1,
        babies: 1,
        babyNames: ['Noor'],
        events: 3,
      },
    ])
  })

  test('two runs over unchanged data print exactly the same thing', async () => {
    const { t } = await seedBabyLog()

    const first = await t.query(verify, {})
    const second = await t.query(verify, {})

    expect(second).toEqual(first)
  })

  test('samples entries with who logged them and a payload fingerprint', async () => {
    const { t, aliceId, bobId } = await seedBabyLog()

    const report = await t.query(verify, {})

    expect(report.sample).toHaveLength(3)
    expect(report.sample.map((s) => [s.baby, s.type, s.loggedBy])).toEqual([
      ['Noor', 'feeding', aliceId],
      ['Noor', 'temperature', bobId],
      ['Noor', 'diaper', bobId],
    ])
    expect(new Set(report.sample.map((s) => s.dataDigest)).size).toBe(3)
  })

  test('a changed payload changes the sample, which is the point', async () => {
    const { t } = await seedBabyLog()
    const before = await t.query(verify, {})

    await t.run(async (ctx) => {
      const [event] = await ctx.db.query('babyEvents').take(1)
      await ctx.db.patch(event._id, { data: { method: 'bottle', amountMl: 91 } })
    })

    expect(await t.query(verify, {})).not.toEqual(before)
  })

  test('writes nothing', async () => {
    const { t } = await seedBabyLog()
    const before = await logContents(t)

    await t.query(verify, {})

    expect(await logContents(t)).toEqual(before)
  })
})

describe('moveBabyToGroup', () => {
  test('changes nothing until asked to apply', async () => {
    const { t, noor } = await seedBabyLog()
    const before = await logContents(t)

    const summary = await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
    })

    expect(summary).toMatchObject({
      apply: false,
      alreadyInTargetGroup: false,
      babiesMoved: 1,
      taskListsMoved: 2,
      eventsCarried: 3,
      eventsRewritten: 0,
    })
    expect(await groupOfBaby(t, noor)).toBe('me-alice')
    expect(await logContents(t)).toEqual(before)
  })

  test('says which Group it would move from and to, and whether it is Personal', async () => {
    const { t, noor } = await seedBabyLog()

    const summary = await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
    })

    expect(summary.from).toEqual({
      slug: 'me-alice',
      name: 'Alice things',
      isPersonal: true,
      members: 1,
    })
    expect(summary.to).toEqual({
      slug: 'jansen-household',
      name: 'Jansen Household',
      isPersonal: false,
      members: 2,
    })
  })

  test('reports a Personal target rather than deciding for the operator', async () => {
    const { t, noor, household } = await seedBabyLog()
    await t.run(async (ctx) => {
      await ctx.db.patch(noor, { groupId: household })
    })

    const summary = await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'me-alice',
    })

    expect(summary.to).toMatchObject({ isPersonal: true, members: 1 })
    expect(summary.babiesMoved).toBe(1)
  })

  test('moves the child and leaves every entry exactly as it was', async () => {
    const { t, noor } = await seedBabyLog()
    const before = await logContents(t)

    const summary = await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    expect(summary).toMatchObject({ apply: true, babiesMoved: 1 })
    expect(await groupOfBaby(t, noor)).toBe('jansen-household')
    // Same rows, same ids, same payloads, same timestamps, same attribution.
    expect(await logContents(t)).toEqual(before)
  })

  test('carries the to-do and questions lists with the child', async () => {
    const { t, noor, todos, questions, household } = await seedBabyLog()

    await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    const groupsOfLists = await t.run(async (ctx) => [
      (await ctx.db.get(todos))?.groupId,
      (await ctx.db.get(questions))?.groupId,
    ])
    expect(groupsOfLists).toEqual([household, household])
  })

  test('leaves everything alone the second time it is applied', async () => {
    const { t, noor } = await seedBabyLog()
    await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })
    const afterFirst = await logContents(t)
    const verifiedFirst = await t.query(verify, {})

    const summary = await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    expect(summary).toMatchObject({
      alreadyInTargetGroup: true,
      babiesMoved: 0,
      taskListsMoved: 0,
      taskListsMissing: 0,
      eventsRewritten: 0,
    })
    expect(await logContents(t)).toEqual(afterFirst)
    expect(await t.query(verify, {})).toEqual(verifiedFirst)
  })

  test('the whole log reads the same before and after, by verification', async () => {
    const { t, noor } = await seedBabyLog()
    const before = await t.query(verify, {})

    await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    const after = await t.query(verify, {})
    // The counts moved between Groups, and nothing else moved at all: the same
    // number of children, the same number of entries, and a sample that is
    // identical line for line.
    expect(after.totals).toEqual(before.totals)
    expect(after.sample).toEqual(before.sample)
    expect(after.groups.map((g) => [g.slug, g.babies, g.events])).toEqual([
      ['jansen-household', 1, 3],
      ['me-alice', 0, 0],
    ])
  })

  test('refuses a Group that does not exist', async () => {
    const { t, noor } = await seedBabyLog()

    await expect(
      t.mutation(moveBaby, { babyId: noor, toGroupSlug: 'no-such-household' }),
    ).rejects.toThrow(/No group has that slug/)
  })

  test('refuses a Group nobody is a Member of', async () => {
    const { t, noor } = await seedBabyLog()
    await t.run(async (ctx) => {
      await ctx.db.insert('groups', {
        name: 'Abandoned',
        inviteCode: 'abandoned-code',
        slug: 'abandoned',
        isPersonal: false,
      })
    })

    await expect(
      t.mutation(moveBaby, { babyId: noor, toGroupSlug: 'abandoned' }),
    ).rejects.toThrow(/no members/)
  })
})

/**
 * The move is the seam between the migration and the app: once a child is in
 * the household Group, both parents reach the log through the real queries and
 * neither of them goes through anything the migration left behind.
 */
describe('after the move, the household shares the log', () => {
  test('the second parent can read and log for the child', async () => {
    const { t, noor } = await seedBabyLog()

    // Before: Bob is in the household, and the child is not.
    await expect(
      t.withIdentity(asBob).query(api.babyEvents.listByBaby, {
        babyId: noor,
        groupSlug: 'jansen-household',
      }),
    ).rejects.toThrow(/Baby not found/)

    await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    const events = await t.withIdentity(asBob).query(api.babyEvents.listByBaby, {
      babyId: noor,
      groupSlug: 'jansen-household',
    })
    expect(events).toHaveLength(3)

    await t.withIdentity(asBob).mutation(api.babyEvents.add, {
      babyId: noor,
      groupSlug: 'jansen-household',
      type: 'diaper',
      timestamp: 1_760_010_800_000,
      data: { kind: 'wet' },
    })
    const afterAdd = await t
      .withIdentity(asAlice)
      .query(api.babyEvents.listByBaby, {
        babyId: noor,
        groupSlug: 'jansen-household',
      })
    expect(afterAdd).toHaveLength(4)
  })

  test('Alice can no longer reach the child through her Personal group', async () => {
    const { t, noor } = await seedBabyLog()

    await t.mutation(moveBaby, {
      babyId: noor,
      toGroupSlug: 'jansen-household',
      apply: true,
    })

    expect(
      await t
        .withIdentity(asAlice)
        .query(api.babies.get, { id: noor, groupSlug: 'me-alice' }),
    ).toBeNull()
  })
})

/**
 * A food written before `searchText` existed has no value in the search index
 * and therefore matches nothing at all — the backfill is what makes the whole
 * library findable rather than only the rows written since. See
 * docs/migrations/0005-food-search-text.md.
 */
describe('backfilling foods.searchText', () => {
  async function foodWithoutSearchText() {
    const t = testConvex()
    await t.withIdentity(asAlice).mutation(api.users.ensureUser, {})
    const id = await t.withIdentity(asAlice).mutation(api.foods.create, {
      name: 'Halfvolle melk',
      brand: 'Campina',
      baseUnit: 'ml',
      nutritionPer100: { calories: 46 },
    })
    // As the row existed before this field did.
    await t.run(async (ctx) => {
      await ctx.db.patch(id, { searchText: undefined })
    })
    return { t, id }
  }

  // What a row without the field does to a *search* is not asserted here:
  // convex-test's search-index fake throws on a document missing the search
  // field where real Convex simply does not match it. So the before state is
  // read off the row and the after state is read through the query.
  test('a row written before the field existed becomes findable by name and by brand', async () => {
    const { t, id } = await foodWithoutSearchText()

    expect(
      await t.run(async (ctx) => (await ctx.db.get(id))?.searchText),
    ).toBeFalsy()

    await t.mutation(internal.maintenance.backfillFoodSearchText, {
      apply: true,
    })

    expect(
      (
        await t.withIdentity(asAlice).query(api.foods.search, { term: 'melk' })
      ).map((f) => f.name),
    ).toEqual(['Halfvolle melk'])
    expect(
      (
        await t
          .withIdentity(asAlice)
          .query(api.foods.search, { term: 'campina' })
      ).map((f) => f.name),
    ).toEqual(['Halfvolle melk'])
  })

  test('a dry run writes nothing and says what it would have written', async () => {
    const { t, id } = await foodWithoutSearchText()

    expect(
      await t.mutation(internal.maintenance.backfillFoodSearchText, {}),
    ).toEqual({ apply: false, foods: 1, updated: 1 })
    expect(
      await t.run(async (ctx) => (await ctx.db.get(id))?.searchText),
    ).toBeFalsy()
  })

  test('running it twice is a no-op the second time', async () => {
    const { t } = await foodWithoutSearchText()

    await t.mutation(internal.maintenance.backfillFoodSearchText, {
      apply: true,
    })

    expect(
      await t.mutation(internal.maintenance.backfillFoodSearchText, {
        apply: true,
      }),
    ).toEqual({ apply: true, foods: 1, updated: 0 })
  })
})

/**
 * Carrying a food's single serving into the list, and dropping the pair it
 * lived in — the contract half of #68, and the thing that has to have run
 * before the deploy that removes the fields (docs/migrations/0006).
 *
 * Like the Group backfill above, this can only be tested against rows the
 * current schema no longer allows, so it builds its backend on the shape those
 * rows actually have on disk.
 */
const legacyFoodSchema = defineSchema({
  ...schema.tables,
  foods: defineTable({
    name: v.string(),
    brand: v.optional(v.string()),
    barcode: v.optional(v.string()),
    baseUnit: v.union(v.literal('g'), v.literal('ml')),
    nutritionPer100: v.any(),
    servings: v.optional(
      v.array(v.object({ label: v.string(), amount: v.number() })),
    ),
    // The pair #71 removes.
    servingSize: v.optional(v.number()),
    servingLabel: v.optional(v.string()),
    source: v.union(
      v.literal('openfoodfacts'),
      v.literal('manual'),
      v.literal('seed'),
    ),
    localEdited: v.optional(v.boolean()),
    createdBy: v.optional(v.id('users')),
    seedKey: v.optional(v.string()),
    searchText: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
  })
    .index('by_barcode', ['barcode'])
    .index('by_seedKey', ['seedKey'])
    .searchIndex('search_by_text', { searchField: 'searchText' }),
})

describe('backfillFoodServings', () => {
  async function withLegacyFoods() {
    const t = convexTest(legacyFoodSchema, modules)
    const ids = await t.run(async (ctx) => ({
      labelled: await ctx.db.insert('foods', {
        name: 'Wholemeal bread',
        baseUnit: 'g',
        nutritionPer100: { calories: 250 },
        servingSize: 40,
        servingLabel: '1 slice (40 g)',
        source: 'manual',
      }),
      unlabelled: await ctx.db.insert('foods', {
        name: 'Whole milk',
        baseUnit: 'ml',
        nutritionPer100: { calories: 61 },
        servingSize: 250,
        source: 'openfoodfacts',
      }),
      alreadyMoved: await ctx.db.insert('foods', {
        name: 'Granola',
        baseUnit: 'g',
        nutritionPer100: { calories: 471 },
        servingSize: 50,
        servingLabel: 'legacy',
        servings: [{ label: '1 bowl', amount: 50 }],
        source: 'manual',
      }),
      neverHadOne: await ctx.db.insert('foods', {
        name: 'Flour',
        baseUnit: 'g',
        nutritionPer100: { calories: 364 },
        source: 'seed',
        seedKey: 'flour-plain',
      }),
    }))
    return { t, ids }
  }

  const read = async (t: ReturnType<typeof convexTest>, id: Id<'foods'>) =>
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(id)) as Record<string, unknown> | null
      return {
        servings: row?.servings,
        hasLegacy: row ? 'servingSize' in row || 'servingLabel' in row : false,
      }
    })

  test('changes nothing until asked to apply', async () => {
    const { t, ids } = await withLegacyFoods()

    expect(
      await t.mutation(internal.maintenance.backfillFoodServings, {}),
    ).toEqual({ apply: false, foods: 4, stripped: 3, converted: 2 })
    expect((await read(t, ids.labelled)).hasLegacy).toBe(true)
  })

  test('carries the serving across, named by its label or by its own amount', async () => {
    const { t, ids } = await withLegacyFoods()

    await t.mutation(internal.maintenance.backfillFoodServings, { apply: true })

    expect(await read(t, ids.labelled)).toEqual({
      servings: [{ label: '1 slice (40 g)', amount: 40 }],
      hasLegacy: false,
    })
    expect(await read(t, ids.unlabelled)).toEqual({
      servings: [{ label: '250 ml', amount: 250 }],
      hasLegacy: false,
    })
  })

  test('leaves a list that already exists alone, and only drops the old fields', async () => {
    const { t, ids } = await withLegacyFoods()

    await t.mutation(internal.maintenance.backfillFoodServings, { apply: true })

    expect(await read(t, ids.alreadyMoved)).toEqual({
      servings: [{ label: '1 bowl', amount: 50 }],
      hasLegacy: false,
    })
  })

  test('a row that never had one is untouched, and a second run finds nothing', async () => {
    const { t, ids } = await withLegacyFoods()

    await t.mutation(internal.maintenance.backfillFoodServings, { apply: true })

    expect(await read(t, ids.neverHadOne)).toEqual({
      servings: undefined,
      hasLegacy: false,
    })
    expect(
      await t.mutation(internal.maintenance.backfillFoodServings, {
        apply: true,
      }),
    ).toEqual({ apply: true, foods: 4, stripped: 0, converted: 0 })
  })
})
