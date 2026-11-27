/**
 * Deleting an account whose own rows do not fit one step (APP-843). The
 * backend here refuses what Convex would.
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

type Harness = ReturnType<typeof testConvexWithLimits>

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function people() {
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
    return { aliceId, bobId }
  })
  return { t, ...ids }
}

async function seedReceipts(t: Harness, userId: Id<'users'>, many: number) {
  for (let start = 0; start < many; start += 5000)
    await t.run(async (ctx) => {
      for (let i = start; i < Math.min(start + 5000, many); i += 1)
        await ctx.db.insert('idempotencyKeys', {
          userId,
          key: `key-${String(i).padStart(6, '0')}`,
          table: 'notes',
          docId: 'doc',
        })
    })
}

async function seedUsage(t: Harness, userId: Id<'users'>, many: number) {
  await t.run(async (ctx) => {
    for (let i = 0; i < many; i += 1)
      await ctx.db.insert('aiUsage', { userId, day: `day-${i}`, count: 1 })
  })
}

const count = (t: Harness, table: TableNames) =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length)

/** Run one step, without the ones it schedules. */
const step = (t: Harness, userId: Id<'users'>) =>
  t.mutation(internal.cascade.purgeAccount, { userId, groupIds: [] })

async function settle(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  const jobs = await t.run((ctx) =>
    ctx.db.system.query('_scheduled_functions').collect(),
  )
  expect(
    jobs.every(({ state }) => ['success', 'canceled'].includes(state.kind)),
  ).toBe(true)
}

const deleteAccount = (t: Harness) =>
  t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})

describe('an account above one batch', () => {
  test('goes 500 rows a step, over all its tables together', async () => {
    const { t, aliceId } = await people()
    await seedUsage(t, aliceId, 300)
    await seedReceipts(t, aliceId, 900)

    await step(t, aliceId)
    expect(await count(t, 'aiUsage')).toBe(0)
    expect(await count(t, 'idempotencyKeys')).toBe(700)
    // The row that keeps the account from coming back goes last.
    expect(await t.run((ctx) => ctx.db.get(aliceId))).not.toBeNull()

    await settle(t)
    expect(await count(t, 'idempotencyKeys')).toBe(0)
    expect(await t.run((ctx) => ctx.db.get(aliceId))).toBeNull()
  }, 60_000)

  test('is deleted whole when its receipts pass one transaction, and nobody else’s go', async () => {
    const { t, aliceId, bobId } = await people()
    await seedReceipts(t, aliceId, 16_500)
    await seedReceipts(t, bobId, 2)
    await seedUsage(t, bobId, 2)

    await deleteAccount(t)
    await settle(t)

    expect(await count(t, 'idempotencyKeys')).toBe(2)
    expect(await count(t, 'aiUsage')).toBe(2)
    expect(await t.run((ctx) => ctx.db.get(aliceId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(bobId))).not.toBeNull()
  }, 120_000)

  test('of exactly one batch is deleted whole', async () => {
    const { t, aliceId } = await people()
    await seedReceipts(t, aliceId, 500)
    await deleteAccount(t)
    await settle(t)
    expect(await count(t, 'idempotencyKeys')).toBe(0)
    expect(await t.run((ctx) => ctx.db.get(aliceId))).toBeNull()
  })

  test('goes on when a stopped chain is started again', async () => {
    const { t, aliceId } = await people()
    await seedReceipts(t, aliceId, 1200)
    await step(t, aliceId)
    // The next step never runs.
    await t.run(async (ctx) => {
      for (const job of await ctx.db.system
        .query('_scheduled_functions')
        .collect())
        await ctx.scheduler.cancel(job._id)
    })
    await settle(t)
    expect(await count(t, 'idempotencyKeys')).toBe(700)

    await step(t, aliceId)
    await settle(t)
    expect(await count(t, 'idempotencyKeys')).toBe(0)
    expect(await t.run((ctx) => ctx.db.get(aliceId))).toBeNull()
  })

  test('loses its watches in the first step and cancels its queued sends', async () => {
    const { t, aliceId, bobId } = await people()
    const at = Date.now() + 24 * 60 * 60 * 1000
    await t.run(async (ctx) => {
      const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      await seedMember(ctx, groupId, aliceId)
      await seedMember(ctx, groupId, bobId, 'admin')
      await ctx.db.insert('watchDevices', {
        userId: aliceId,
        groupId,
        keyHash: 'hash',
        installId: 'watch',
        createdAt: 1,
      })
      await ctx.db.insert('pushDevices', {
        userId: aliceId,
        token: 'token',
        platform: 'ios',
        locale: 'en',
        updatedAt: 1,
      })
      const listId = await ctx.db.insert('taskLists', {
        groupId,
        name: 'Chores',
        provider: 'local',
        order: 0,
      })
      const taskId = await ctx.db.insert('tasks', {
        listId,
        title: 'Bins',
        done: false,
        createdBy: aliceId,
        order: 0,
      })
      for (let i = 0; i < 601; i += 1) {
        const rowId = await ctx.db.insert('scheduledNotifications', {
          userId: i === 600 ? bobId : aliceId,
          dedupeKey: `key ${i}`,
          at,
          payload: {
            kind: 'taskReminder',
            groupId,
            target: { type: 'task', id: taskId },
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

    await step(t, aliceId)
    expect(await count(t, 'watchDevices')).toBe(0)
    expect(await count(t, 'scheduledNotifications')).toBe(103)

    // The sends are a day away, so none fires before its step cancels it.
    for (let i = 0; i < 10; i += 1) {
      vi.advanceTimersByTime(1000)
      await t.finishInProgressScheduledFunctions()
    }
    const left = await t.run(async (ctx) => ({
      sends: (await ctx.db.query('scheduledNotifications').collect()).map(
        (row) => row.userId,
      ),
      jobs: (await ctx.db.system.query('_scheduled_functions').collect())
        .filter((job) => job.name.includes('fireScheduled'))
        .map((job) => job.state.kind),
      phones: await ctx.db.query('pushDevices').collect(),
      user: await ctx.db.get(aliceId),
    }))
    expect(left.sends).toEqual([bobId])
    expect(left.jobs.filter((kind) => kind === 'canceled').length).toBe(600)
    expect(left.jobs.filter((kind) => kind === 'pending').length).toBe(1)
    expect(left.phones).toEqual([])
    expect(left.user).toBeNull()
  }, 60_000)
})

test('each shared Group is left in a step of its own', async () => {
  const { t, aliceId, bobId } = await people()
  await t.run(async (ctx) => {
    for (const slug of ['one', 'two', 'three']) {
      const groupId = await seedGroup(ctx, { name: slug, slug })
      await seedMember(ctx, groupId, aliceId)
      await seedMember(ctx, groupId, bobId, 'admin')
      await ctx.db.insert('recurringCosts', {
        groupId,
        createdByUserId: bobId,
        name: 'Internet',
        amountCents: 4500,
        frequency: 'monthly',
        category: 'utilities',
        split: [
          { userId: aliceId, percent: 50 },
          { userId: bobId, percent: 50 },
        ],
        order: 0,
      })
    }
  })

  const splits = () =>
    t.run(async (ctx) =>
      (await ctx.db.query('recurringCosts').collect()).filter(
        (cost) => cost.split,
      ).length,
    )
  await step(t, aliceId)
  expect(await splits()).toBe(2)
  expect(await count(t, 'memberships')).toBe(5)

  await settle(t)
  expect(await splits()).toBe(0)
  expect(await count(t, 'memberships')).toBe(3)
  expect(await count(t, 'groups')).toBe(3)
  expect(await t.run((ctx) => ctx.db.get(aliceId))).toBeNull()
})

describe('the last Members deleting their accounts together (APP-882)', () => {
  async function sharedHome(t: Harness, members: Id<'users'>[]) {
    return await t.run(async (ctx) => {
      const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      for (const userId of members) await seedMember(ctx, groupId, userId)
      await ctx.db.insert('notes', {
        groupId,
        title: 'Wifi',
        body: 'hunter2',
        createdBy: members[0],
        updatedAt: 1,
      })
      return groupId
    })
  }

  test('take the Group and its content with them', async () => {
    const { t, aliceId, bobId } = await people()
    const groupId = await sharedHome(t, [aliceId, bobId])

    // Both start before either purge reaches the Group, so each sees it shared.
    await t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})
    await t.withIdentity(bob).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    expect(await t.run((ctx) => ctx.db.get(groupId))).toBeNull()
    expect(await count(t, 'memberships')).toBe(0)
    expect(await count(t, 'notes')).toBe(0)
    expect(await count(t, 'users')).toBe(0)
  })

  test('leave a Group somebody still lives in', async () => {
    const { t, aliceId, bobId } = await people()
    const carolId = await t.run((ctx) =>
      ctx.db.insert('users', { clerkId: 'clerk_carol', name: 'C', email: '' }),
    )
    const groupId = await sharedHome(t, [aliceId, bobId, carolId])

    await t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})
    await t.withIdentity(bob).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    expect(await t.run((ctx) => ctx.db.get(groupId))).not.toBeNull()
    expect(await count(t, 'memberships')).toBe(1)
    expect(await count(t, 'notes')).toBe(1)
  })

  test('take a Group made after the purge began', async () => {
    const { t, aliceId } = await people()
    await t.withIdentity(alice).mutation(api.accounts.deleteAccount, {})
    // Made behind the refusal's back, e.g. by a request already in flight.
    const groupId = await sharedHome(t, [aliceId])
    await settle(t)

    expect(await t.run((ctx) => ctx.db.get(groupId))).toBeNull()
    expect(await count(t, 'notes')).toBe(0)
  })
})

describe('a Group whose only admin deletes their account (APP-938)', () => {
  const carol = { subject: 'clerk_carol', name: 'Carol', email: 'c@example.com' }

  async function household(
    t: Harness,
    roles: [Id<'users'>, 'admin' | 'member'][],
  ) {
    return await t.run(async (ctx) => {
      const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
      for (const [userId, role] of roles)
        await seedMember(ctx, groupId, userId, role)
      return groupId
    })
  }

  async function withCarol(t: Harness) {
    return await t.run((ctx) =>
      ctx.db.insert('users', {
        clerkId: carol.subject,
        name: carol.name,
        email: carol.email,
      }),
    )
  }

  const roles = (t: Harness, groupId: Id<'groups'>) =>
    t.run(async (ctx) => {
      const rows = await ctx.db
        .query('memberships')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect()
      return Object.fromEntries(rows.map((row) => [row.userId, row.role]))
    })

  test('hands the admin role to the longest-standing Member staying', async () => {
    const { t, aliceId, bobId } = await people()
    const carolId = await withCarol(t)
    const groupId = await household(t, [
      [aliceId, 'admin'],
      [bobId, 'member'],
      [carolId, 'member'],
    ])

    await deleteAccount(t)
    await settle(t)

    expect(await roles(t, groupId)).toEqual({
      [bobId]: 'admin',
      [carolId]: 'member',
    })
    // The new admin can administer the Group.
    await t
      .withIdentity(bob)
      .mutation(api.groups.renameGroup, { groupId, name: 'Our home' })
    expect((await t.run((ctx) => ctx.db.get(groupId)))?.name).toBe('Our home')
  })

  test('promotes nobody when another admin stays', async () => {
    const { t, aliceId, bobId } = await people()
    const carolId = await withCarol(t)
    const groupId = await household(t, [
      [aliceId, 'admin'],
      [bobId, 'member'],
      [carolId, 'admin'],
    ])

    await deleteAccount(t)
    await settle(t)

    expect(await roles(t, groupId)).toEqual({
      [bobId]: 'member',
      [carolId]: 'admin',
    })
  })

  test('does not count an admin whose account is being deleted too', async () => {
    const { t, aliceId, bobId } = await people()
    const carolId = await withCarol(t)
    const groupId = await household(t, [
      [aliceId, 'admin'],
      [bobId, 'admin'],
      [carolId, 'member'],
    ])

    await deleteAccount(t)
    await t.withIdentity(bob).mutation(api.accounts.deleteAccount, {})
    await settle(t)

    expect(await roles(t, groupId)).toEqual({ [carolId]: 'admin' })
  })

  test('changes no role when a Member who is not an admin goes', async () => {
    const { t, aliceId, bobId } = await people()
    const carolId = await withCarol(t)
    const groupId = await household(t, [
      [aliceId, 'member'],
      [bobId, 'admin'],
      [carolId, 'member'],
    ])

    await deleteAccount(t)
    await settle(t)

    expect(await roles(t, groupId)).toEqual({
      [bobId]: 'admin',
      [carolId]: 'member',
    })
  })
})
