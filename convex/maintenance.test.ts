import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { alice as asAlice, bob as asBob, modules, seedMember, testConvex } from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'


/**
 * The baby log's move onto Group scope, behind #20.
 *
 * This is the one migration in the rebuild that touches data nobody can
 * re-enter, so the tests are written as the acceptance criteria are: every
 * baby and every event present afterwards, payloads and timestamps unchanged,
 * attribution intact, and a second run that neither duplicates nor corrupts
 * anything. See docs/records/2026-08-01-migration-0003-baby-log-onto-group-scope.md.
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
      await seedMember(ctx, groupId, userId, role)
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
      await ctx.db.patch(event._id, {
        data: { method: 'bottle', amountMl: 91 },
      })
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

    const events = await t
      .withIdentity(asBob)
      .query(api.babyEvents.listByBaby, {
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
 * What the retired Nutrition Module left behind (docs/migrations/0008). The
 * tables are gone from the schema, so the backend is built on the shape the
 * rows still have on disk, the way a deployment that had the Module holds them.
 */
const retiredNutritionSchema = defineSchema({
  ...schema.tables,
  foods: defineTable({
    name: v.string(),
    imageId: v.optional(v.id('_storage')),
  }),
  consumptionEntries: defineTable({ userId: v.id('users'), date: v.string() }),
  combos: defineTable({ userId: v.id('users'), name: v.string() }),
  comboItems: defineTable({ comboId: v.id('combos'), label: v.string() }),
})

describe('retireNutrition', () => {
  async function withNutrition() {
    const t = convexTest(retiredNutritionSchema, modules)
    const ids = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkId: asAlice.subject,
        name: 'Alice',
        email: asAlice.email,
        nutritionTargets: { calories: 2000 },
      })
      const otherId = await ctx.db.insert('users', {
        clerkId: asBob.subject,
        name: 'Bob',
        email: asBob.email,
      })
      const imageId = await ctx.storage.store(new Blob(['jpeg']))
      await ctx.db.insert('foods', { name: 'Granola', imageId })
      await ctx.db.insert('foods', { name: 'Flour' })
      await ctx.db.insert('consumptionEntries', { userId, date: '2026-11-09' })
      const comboId = await ctx.db.insert('combos', { userId, name: 'Lunch' })
      await ctx.db.insert('comboItems', { comboId, label: 'Bread' })
      await ctx.db.insert('comboItems', { comboId, label: 'Cheese' })
      return { userId, otherId, imageId }
    })
    const left = async () =>
      await t.run(async (ctx) => ({
        foods: (await ctx.db.query('foods').collect()).length,
        consumptionEntries: (await ctx.db.query('consumptionEntries').collect())
          .length,
        combos: (await ctx.db.query('combos').collect()).length,
        comboItems: (await ctx.db.query('comboItems').collect()).length,
        image: (await ctx.storage.getUrl(ids.imageId)) !== null,
        targets: (await ctx.db.get(ids.userId))?.nutritionTargets,
      }))
    return { t, ids, left }
  }

  const everything = {
    comboItems: 2,
    combos: 1,
    consumptionEntries: 1,
    foods: 2,
  }

  test('only reports without apply', async () => {
    const { t, left } = await withNutrition()
    expect(await t.mutation(internal.maintenance.retireNutrition, {})).toEqual({
      apply: false,
      deleted: everything,
      images: 1,
      nutritionTargets: 1,
      more: false,
    })
    expect(await left()).toEqual({
      ...everything,
      image: true,
      targets: { calories: 2000 },
    })
  })

  test('deletes every row, the pictures and the targets, and finds nothing the second time', async () => {
    const { t, ids, left } = await withNutrition()
    await t.mutation(internal.maintenance.retireNutrition, { apply: true })

    expect(await left()).toEqual({
      foods: 0,
      consumptionEntries: 0,
      combos: 0,
      comboItems: 0,
      image: false,
      targets: undefined,
    })
    const people = await t.run(async (ctx) => [
      await ctx.db.get(ids.userId),
      await ctx.db.get(ids.otherId),
    ])
    expect(people.map((person) => person?.name)).toEqual(['Alice', 'Bob'])
    expect(
      await t.mutation(internal.maintenance.retireNutrition, { apply: true }),
    ).toEqual({
      apply: true,
      deleted: { comboItems: 0, combos: 0, consumptionEntries: 0, foods: 0 },
      images: 0,
      nutritionTargets: 0,
      more: false,
    })
  })

  test('stops at one batch and says there is more', async () => {
    const { t } = await withNutrition()
    await t.run(async (ctx) => {
      for (let i = 0; i < 200; i++) {
        await ctx.db.insert('foods', { name: `Food ${i}` })
      }
    })
    const first = await t.mutation(internal.maintenance.retireNutrition, {
      apply: true,
    })
    expect(first.deleted).toEqual({
      comboItems: 2,
      combos: 1,
      consumptionEntries: 1,
      foods: 196,
    })
    expect(first.more).toBe(true)
    const second = await t.mutation(internal.maintenance.retireNutrition, {
      apply: true,
    })
    expect(second.deleted.foods).toBe(6)
    expect(second.more).toBe(false)
  })

  test('a deployment that never had the tables reads them as empty', async () => {
    const t = testConvex()
    expect(
      await t.mutation(internal.maintenance.retireNutrition, { apply: true }),
    ).toEqual({
      apply: true,
      deleted: { comboItems: 0, combos: 0, consumptionEntries: 0, foods: 0 },
      images: 0,
      nutritionTargets: 0,
      more: false,
    })
  })
})

describe('cleanUserDocuments', () => {
  const withStrayField = defineSchema({
    ...schema.tables,
    users: defineTable({
      ...schema.tables.users.validator.fields,
      removedExperiment: v.optional(v.string()),
    }),
  })

  test('strips what the schema does not name and keeps everything it does', async () => {
    const t = convexTest(withStrayField, modules)
    const id = await t.run(
      async (ctx) =>
        await ctx.db.insert('users', {
          clerkId: 'clerk_alice',
          name: 'Alice',
          email: 'a@example.com',
          deletedAt: 123,
          nutritionTargets: { calories: 2000 },
          pinnedModuleIds: ['recipes'],
          removedExperiment: 'stray',
        }),
    )

    await t.mutation(internal.maintenance.cleanUserDocuments, {})

    const user = await t.run(async (ctx) => await ctx.db.get(id))
    expect(user).toMatchObject({
      clerkId: 'clerk_alice',
      deletedAt: 123,
      nutritionTargets: { calories: 2000 },
      pinnedModuleIds: ['recipes'],
    })
    expect(user).not.toHaveProperty('removedExperiment')
  })
})

describe('mergeDuplicateUsers', () => {
  /** One person with two rows, and something of theirs in a shared Group. */
  async function withDuplicate() {
    const t = testConvex()
    const ids = await t.run(async (ctx) => {
      const person = { clerkId: 'clerk_alice', name: 'Alice', email: 'a@x.nl' }
      const keep = await ctx.db.insert('users', person)
      const dupe = await ctx.db.insert('users', person)
      const groupId = await ctx.db.insert('groups', {
        name: 'Household',
        inviteCode: 'INVITE',
        slug: 'household',
      })
      await seedMember(ctx, groupId, keep, 'admin')
      await seedMember(ctx, groupId, dupe, 'member')
      const calendarId = await ctx.db.insert('calendars', {
        groupId,
        name: 'Home',
        source: 'local',
        createdBy: dupe,
      })
      const rows = {
        note: await ctx.db.insert('notes', {
          groupId,
          title: 'A note',
          body: '',
          createdBy: dupe,
          updatedBy: dupe,
          updatedAt: 0,
        }),
        cost: await ctx.db.insert('recurringCosts', {
          groupId,
          createdByUserId: dupe,
          name: 'Energy',
          amountCents: 100,
          frequency: 'monthly',
          category: 'utilities',
          split: [{ userId: dupe, percent: 100 }],
          order: 0,
        }),
        event: await ctx.db.insert('calendarEvents', {
          calendarId,
          title: 'Dentist',
          date: '2026-09-01',
          createdBy: dupe,
          assigneeIds: [keep, dupe],
        }),
      }
      await ctx.db.insert('aiUsage', { userId: keep, day: '2026-09-01', count: 2 })
      await ctx.db.insert('aiUsage', { userId: dupe, day: '2026-09-01', count: 3 })
      await ctx.db.insert('aiUsage', { userId: dupe, day: '2026-09-02', count: 1 })
      return { keep, dupe, ...rows }
    })
    return { t, ...ids }
  }

  test('repoints references the app reads, in columns and inside values', async () => {
    const { t, keep, dupe, note, cost, event } = await withDuplicate()

    await t.mutation(internal.maintenance.mergeDuplicateUsers, { apply: true })

    const after = await t.run(async (ctx) => ({
      dupe: await ctx.db.get(dupe),
      note: await ctx.db.get(note),
      cost: await ctx.db.get(cost),
      event: await ctx.db.get(event),
      memberships: await ctx.db.query('memberships').collect(),
    }))
    expect(after.dupe).toBeNull()
    expect(after.note).toMatchObject({ createdBy: keep, updatedBy: keep })
    expect(after.cost).toMatchObject({
      createdByUserId: keep,
      split: [{ userId: keep, percent: 100 }],
    })
    expect(after.event?.createdBy).toBe(keep)
    expect(after.event?.assigneeIds).toEqual([keep])
    expect(after.memberships.map((m) => m.userId)).toEqual([keep])
  })

  test('adds up one person’s AI budget rather than leaving two rows for a day', async () => {
    const { t, keep } = await withDuplicate()

    await t.mutation(internal.maintenance.mergeDuplicateUsers, { apply: true })

    const usage = await t.run(async (ctx) => await ctx.db.query('aiUsage').collect())
    expect(
      usage.map(({ userId, day, count }) => ({ userId, day, count })),
    ).toEqual([
      { userId: keep, day: '2026-09-01', count: 5 },
      { userId: keep, day: '2026-09-02', count: 1 },
    ])
  })

  test('one person named twice in a split becomes one entry with both shares', async () => {
    const { t, keep, dupe } = await withDuplicate()
    const bob = { name: 'Bob' }
    const { cost, scenario } = await t.run(async (ctx) => {
      const groupId = (await ctx.db.query('groups').first())!._id
      const alice = { userId: keep, name: 'Alice' }
      const alias = { userId: dupe, name: 'Alice' }
      return {
        cost: await ctx.db.insert('recurringCosts', {
          groupId,
          createdByUserId: keep,
          name: 'Rent',
          amountCents: 1000,
          frequency: 'monthly',
          category: 'housing',
          split: [
            { userId: keep, percent: 30 },
            { userId: dupe, percent: 20 },
          ],
          order: 1,
        }),
        scenario: await ctx.db.insert('splitScenarios', {
          groupId,
          createdByUserId: dupe,
          createdAt: 0,
          name: 'Weekend',
          payments: [
            { party: alice, amountCents: 600 },
            { party: alias, amountCents: 300 },
          ],
          participants: [alice, alias, bob],
          mode: 'equal',
          owed: [
            { party: alice, amountCents: 300 },
            { party: alias, amountCents: 300 },
            { party: bob, amountCents: 300 },
          ],
          transfers: [
            { from: alias, to: alice, amountCents: 100 },
            { from: bob, to: alice, amountCents: 300 },
          ],
          totalCents: 900,
        }),
      }
    })

    await t.mutation(internal.maintenance.mergeDuplicateUsers, { apply: true })

    const after = await t.run(async (ctx) => ({
      cost: await ctx.db.get(cost),
      scenario: await ctx.db.get(scenario),
    }))
    const alice = { userId: keep, name: 'Alice' }
    expect(after.cost?.split).toEqual([{ userId: keep, percent: 50 }])
    expect(after.scenario).toMatchObject({
      payments: [
        { party: alice, amountCents: 600 },
        { party: alice, amountCents: 300 },
      ],
      participants: [alice, bob],
      owed: [
        { party: alice, amountCents: 600 },
        { party: bob, amountCents: 300 },
      ],
      transfers: [{ from: bob, to: alice, amountCents: 300 }],
    })
  })

  test('only reports without apply', async () => {
    const { t, dupe, note } = await withDuplicate()

    const report = await t.mutation(internal.maintenance.mergeDuplicateUsers, {})

    expect(report.plans[0].repointed).toMatchObject({
      notes: 1,
      recurringCosts: 1,
      calendars: 1,
      calendarEvents: 1,
      aiUsage: 2,
    })
    const untouched = await t.run(async (ctx) => await ctx.db.get(note))
    expect(untouched?.createdBy).toBe(dupe)
  })
})

describe('deleteFinanceSettings', () => {
  async function withRows() {
    const t = testConvex()
    await t.run(async (ctx) => {
      const groupId = await ctx.db.insert('groups', {
        name: 'Household',
        inviteCode: 'INVITE',
        slug: 'household',
      })
      await ctx.db.insert('financeSettings', {
        groupId,
        homeCurrency: 'EUR',
        rates: [{ currency: 'USD', rate: 0.9, asOf: 0 }],
      })
    })
    const remaining = async () =>
      (await t.run(async (ctx) => await ctx.db.query('financeSettings').collect()))
        .length
    return { t, remaining }
  }

  test('only reports without apply', async () => {
    const { t, remaining } = await withRows()
    expect(
      await t.mutation(internal.maintenance.deleteFinanceSettings, {}),
    ).toEqual({ apply: false, deleted: 1, more: false })
    expect(await remaining()).toBe(1)
  })

  test('deletes every row, and finds none the second time', async () => {
    const { t, remaining } = await withRows()
    await t.mutation(internal.maintenance.deleteFinanceSettings, { apply: true })
    expect(await remaining()).toBe(0)
    expect(
      await t.mutation(internal.maintenance.deleteFinanceSettings, {
        apply: true,
      }),
    ).toEqual({ apply: true, deleted: 0, more: false })
  })
})
