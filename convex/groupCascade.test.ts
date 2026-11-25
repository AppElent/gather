/**
 * Deleting a Group larger than one transaction (APP-842). The backend here
 * refuses what Convex would. Notes have their own cases in
 * `noteLimits.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvexWithLimits,
} from '../test/convexHarness'
import { api, internal } from './_generated/api'
import type { Id, TableNames } from './_generated/dataModel'
import { resetSample, SAMPLE_LABEL } from './lib/seed/apply'

type Harness = ReturnType<typeof testConvexWithLimits>

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Alice's own Group, and one she shares with Bob. */
async function households() {
  const t = testConvexWithLimits()
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
    const homeId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
    const clubId = await seedGroup(ctx, { name: 'Club', slug: 'club' })
    await seedMember(ctx, homeId, aliceId, 'admin')
    await seedMember(ctx, clubId, aliceId)
    await seedMember(ctx, clubId, bobId, 'admin')
    await ctx.db.patch(aliceId, { defaultGroupId: homeId })
    await ctx.db.patch(bobId, { defaultGroupId: clubId })
    return { aliceId, bobId, homeId, clubId }
  })
  return { t, me: t.withIdentity(alice), ...ids }
}

const count = (t: Harness, table: TableNames) =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length)

async function settle(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  const steps = await t.run((ctx) =>
    ctx.db.system.query('_scheduled_functions').collect(),
  )
  expect(
    steps.every(({ state }) => ['success', 'canceled'].includes(state.kind)),
  ).toBe(true)
  return steps.filter((step) => step.name.includes('purgeGroup')).length
}

/** A list, a child and a calendar with more rows than one page holds. */
async function fillWithRows(
  t: Harness,
  groupId: Id<'groups'>,
  userId: Id<'users'>,
  many: number,
) {
  return await t.run(async (ctx) => {
    const listId = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    const babyId = await ctx.db.insert('babies', {
      groupId,
      name: 'Mila',
      birthDate: '2026-01-01',
      order: 0,
    })
    const calendarId = await ctx.db.insert('calendars', {
      groupId,
      name: 'Ours',
      source: 'local',
      createdBy: userId,
    })
    for (let index = 0; index < many; index += 1) {
      const taskId = await ctx.db.insert('tasks', {
        listId,
        title: `Task ${index}`,
        done: false,
        createdBy: userId,
        order: index,
      })
      await ctx.db.insert('taskCompletions', {
        groupId,
        taskId,
        completedBy: userId,
        completedAt: 1,
        completedOn: '2026-01-01',
        nextDueDate: '2026-01-02',
      })
      await ctx.db.insert('babyEvents', {
        babyId,
        type: 'note',
        timestamp: index,
        loggedBy: userId,
        data: {},
      })
      await ctx.db.insert('calendarEvents', {
        calendarId,
        title: `Event ${index}`,
        date: '2026-01-01',
        createdBy: userId,
      })
      await ctx.db.insert('mealEntries', {
        groupId,
        title: `Meal ${index}`,
        createdBy: userId,
      })
    }
    const photoId = await ctx.storage.store(new Blob(['photo']))
    await ctx.db.patch(babyId, { photoId })
    return { listId, babyId, calendarId, photoId }
  })
}

const CONTENT = [
  'taskLists',
  'tasks',
  'taskCompletions',
  'babies',
  'babyEvents',
  'calendars',
  'calendarEvents',
  'mealEntries',
] as const

const counts = async (t: Harness) =>
  Object.fromEntries(
    await Promise.all(
      CONTENT.map(async (table) => [table, await count(t, table)] as const),
    ),
  )

const everyTable = (rows: number) =>
  Object.fromEntries(CONTENT.map((table) => [table, rows]))

function recipe(groupId: Id<'groups'>, createdByUserId: Id<'users'>) {
  return {
    groupId,
    sharedGroupIds: [] as Id<'groups'>[],
    createdByUserId,
    title: 'Soup',
    ingredients: [],
    steps: [] as string[],
    tags: [],
  }
}

describe('a Group of many rows', () => {
  test('goes a page at a time, and nothing of another Group with it', async () => {
    const { t, me, aliceId, bobId, homeId, clubId } = await households()
    const { photoId } = await fillWithRows(t, homeId, aliceId, 700)
    await fillWithRows(t, clubId, bobId, 1)

    await me.mutation(api.groups.deleteGroup, { groupId: homeId })
    expect(await count(t, 'tasks')).toBeGreaterThan(1)
    // 3,500 rows of 500 a step.
    expect(await settle(t)).toBeGreaterThanOrEqual(6)

    expect(await counts(t)).toEqual(everyTable(1))
    const left = await t.run(async (ctx) => ({
      photo: await ctx.storage.getUrl(photoId),
      memberships: (await ctx.db.query('memberships').collect()).map(
        (membership) => membership.groupId,
      ),
      defaults: [
        (await ctx.db.get(aliceId))?.defaultGroupId ?? null,
        (await ctx.db.get(bobId))?.defaultGroupId ?? null,
      ],
    }))
    expect(left).toEqual({
      photo: null,
      memberships: [clubId, clubId],
      defaults: [null, clubId],
    })
  }, 60_000)

  test('goes with its only Member’s account', async () => {
    const { t, me, aliceId, bobId, homeId, clubId } = await households()
    await fillWithRows(t, homeId, aliceId, 200)
    await fillWithRows(t, clubId, bobId, 1)
    await me.mutation(api.accounts.deleteAccount, {})
    await settle(t)
    expect(await counts(t)).toEqual(everyTable(1))
    expect(await t.run((ctx) => ctx.db.get(aliceId))).toBe(null)
  }, 60_000)

  test('is out of reach, and loses its credentials, from the first page on', async () => {
    const { t, me, aliceId, homeId } = await households()
    const { listId } = await fillWithRows(t, homeId, aliceId, 300)
    await t.run(async (ctx) => {
      await ctx.db.insert('integrationConnections', {
        groupId: homeId,
        provider: 'todoist',
        accessToken: 'secret',
        accountLabel: 'Todoist',
        connectedBy: aliceId,
      })
      await ctx.db.insert('watchDevices', {
        userId: aliceId,
        groupId: homeId,
        keyHash: 'hash',
        installId: 'watch',
        createdAt: 1,
      })
    })
    await me.mutation(api.groups.deleteGroup, { groupId: homeId })

    expect(await count(t, 'integrationConnections')).toBe(0)
    expect(await count(t, 'watchDevices')).toBe(0)
    expect(await t.run((ctx) => ctx.db.get(listId))).not.toBe(null)
    for (const groupSlug of ['home', 'club'])
      await expect(
        me.query(api.tasks.listByList, { groupSlug, listId }),
      ).rejects.toThrow()
    await settle(t)
    expect(await t.run((ctx) => ctx.db.get(listId))).toBe(null)
  }, 60_000)

  test('that fits one page goes in the one transaction', async () => {
    const { t, me, aliceId, homeId } = await households()
    await fillWithRows(t, homeId, aliceId, 10)
    await me.mutation(api.groups.deleteGroup, { groupId: homeId })
    expect(await counts(t)).toEqual(everyTable(0))
    expect(await settle(t)).toBe(0)
  })

  test('takes its queued sends and their jobs with it', async () => {
    const { t, me, aliceId, homeId, clubId } = await households()
    const { listId } = await fillWithRows(t, homeId, aliceId, 1)
    const at = Date.now() + 24 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      const task = await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', listId))
        .first()
      if (!task) throw new Error('no task')
      for (let index = 0; index < 601; index += 1) {
        const rowId = await ctx.db.insert('scheduledNotifications', {
          userId: aliceId,
          dedupeKey: `key ${index}`,
          at,
          payload: {
            kind: 'taskReminder',
            groupId: index === 0 ? clubId : homeId,
            target: { type: 'task', id: task._id },
          },
          generation: 0,
        })
        const jobId = await ctx.scheduler.runAt(
          at,
          internal.notifications.fireScheduled,
          { rowId, generation: 0 },
        )
        await ctx.db.patch(rowId, { jobId })
      }
    })
    await me.mutation(api.groups.deleteGroup, { groupId: homeId })
    // The sends are a day away, so none fires before its step cancels it.
    for (let step = 0; step < 10; step += 1) {
      vi.advanceTimersByTime(10_000)
      await t.finishInProgressScheduledFunctions()
    }
    expect(await count(t, 'scheduledNotifications')).toBe(1)
    const jobs = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    const kinds = jobs
      .filter((job) => job.name.includes('fireScheduled'))
      .map((job) => job.state.kind)
    expect(kinds.filter((kind) => kind === 'canceled').length).toBe(600)
    expect(kinds.filter((kind) => kind === 'pending').length).toBe(1)
  }, 60_000)
})

describe('a Group of large rows', () => {
  test('goes within the read limit, and a recipe Shared into it stays', async () => {
    const { t, me, aliceId, bobId, homeId, clubId } = await households()
    const steps = ['a'.repeat(600_000)]
    const kept: Id<'recipes'>[] = []
    for (let index = 0; index < 30; index += 1)
      await t.run(async (ctx) => {
        // Alice's own, Shared with the club; and the club's, Shared with her.
        const ownId = await ctx.db.insert('recipes', {
          ...recipe(homeId, aliceId),
          steps,
          sharedGroupIds: [clubId],
        })
        await ctx.db.insert('recipeShares', {
          recipeId: ownId,
          groupId: clubId,
        })
        const clubsId = await ctx.db.insert('recipes', {
          ...recipe(clubId, bobId),
          steps,
          sharedGroupIds: [homeId],
        })
        await ctx.db.insert('recipeShares', {
          recipeId: clubsId,
          groupId: homeId,
        })
        kept.push(clubsId)
      })
    await me.mutation(api.groups.deleteGroup, { groupId: homeId })
    // 36 MB of 2 MiB a step.
    expect(await settle(t)).toBeGreaterThanOrEqual(12)

    expect(await count(t, 'recipeShares')).toBe(0)
    for (const id of kept) {
      const left = await t.run((ctx) => ctx.db.get(id))
      expect(left?.sharedGroupIds).toEqual([])
    }
    expect(
      await t.run(async (ctx) => {
        let recipes = 0
        for await (const row of ctx.db
          .query('recipes')
          .withIndex('by_group', (q) => q.eq('groupId', homeId)))
          recipes += row ? 1 : 0
        return recipes
      }),
    ).toBe(0)
  }, 60_000)
})

test('a Sample household over one page leaves no children behind', async () => {
  const { t, aliceId, homeId } = await households()
  const parents = await fillWithRows(t, homeId, aliceId, 300)
  await t.run((ctx) =>
    ctx.db.insert('seedRuns', {
      label: SAMPLE_LABEL,
      createdAt: 1,
      documentIds: [homeId, parents.listId, parents.babyId, parents.calendarId],
    }),
  )
  await t.run((ctx) => resetSample(ctx))
  await settle(t)
  expect(await counts(t)).toEqual(everyTable(0))
}, 60_000)

test('a step queued before the deploy finishes the Group', async () => {
  const { t, aliceId, homeId } = await households()
  await fillWithRows(t, homeId, aliceId, 1)
  await t.mutation(internal.cascade.purgeNotes, { groupId: homeId })
  await settle(t)
  expect(await counts(t)).toEqual(everyTable(0))
})

test('a waiting grocery item of a deleted Group is not handed the question', async () => {
  const { t, me, aliceId, homeId, clubId } = await households()
  const { listId } = await fillWithRows(t, homeId, aliceId, 300)
  const taskId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('tasks', {
      listId,
      title: 'Yuzu',
      category: 'other',
      done: false,
      createdBy: aliceId,
      order: 999,
    })
    await ctx.db.insert('groceryCategoryCache', {
      name: 'yuzu',
      source: 'ai',
      askedAt: 1,
      waitingTaskIds: [id],
    })
    return id
  })
  await me.mutation(api.groups.deleteGroup, { groupId: homeId })
  expect(await t.run((ctx) => ctx.db.get(taskId))).not.toBe(null)

  await t.mutation(internal.groceryCategories.release, {
    name: 'yuzu',
    handOff: { cleanName: 'yuzu', refusedGroupId: clubId, askerTaskId: taskId },
  })
  expect(await count(t, 'groceryCategoryCache')).toBe(0)
  await settle(t)
})
