/**
 * Deleting one list, calendar or child with more rows than one transaction
 * holds (APP-878). The backend here refuses what Convex would.
 */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  alice,
  seedGroup,
  seedMember,
  testConvexWithLimits,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id, TableNames } from './_generated/dataModel'

type Harness = ReturnType<typeof testConvexWithLimits>

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Short of a row's 1 MiB: twenty of these pass a transaction's 16 MiB read. */
const LARGE = 'x'.repeat(900 * 1024)
const LARGE_ROWS = 20

async function household() {
  const t = testConvexWithLimits()
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const groupId = await seedGroup(ctx, { name: 'Home', slug: 'home' })
    await seedMember(ctx, groupId, userId, 'admin')
    return { userId, groupId }
  })
  return { t, me: t.withIdentity(alice), ...ids }
}

const count = (t: Harness, table: TableNames) =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length)

/** Run every queued step; how many were child purges. */
async function settle(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  const steps = await t.run((ctx) =>
    ctx.db.system.query('_scheduled_functions').collect(),
  )
  expect(
    steps.every(({ state }) => ['success', 'canceled'].includes(state.kind)),
  ).toBe(true)
  return steps.filter((step) => step.name.includes('purgeChildren')).length
}

test('a list of large tasks goes a page at a time, and another list stays', async () => {
  const { t, me, userId, groupId } = await household()
  const { listId, otherId } = await t.run(async (ctx) => {
    const list = (name: string, order: number) =>
      ctx.db.insert('taskLists', { groupId, name, provider: 'local', order })
    return { listId: await list('Chores', 0), otherId: await list('Errands', 1) }
  })
  for (const [id, rows] of [
    [listId, LARGE_ROWS],
    [otherId, 1],
  ] as const) {
    for (let index = 0; index < rows; index += 1) {
      // A row a transaction: the seeding has the same limits.
      await t.run(async (ctx) => {
        const taskId = await ctx.db.insert('tasks', {
          listId: id,
          title: `Task ${index}`,
          notes: LARGE,
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
      })
    }
  }

  await me.mutation(api.taskLists.remove, { listId, groupSlug: 'home' })
  expect(await t.run((ctx) => ctx.db.get(listId))).toBe(null)
  expect(await count(t, 'tasks')).toBeGreaterThan(1)
  expect(await settle(t)).toBeGreaterThan(1)

  expect(await count(t, 'tasks')).toBe(1)
  expect(await count(t, 'taskCompletions')).toBe(1)
  expect(await t.run((ctx) => ctx.db.get(otherId))).not.toBe(null)
}, 60_000)

test('a calendar of large events goes a page at a time', async () => {
  const { t, me, userId, groupId } = await household()
  const calendarId = await t.run((ctx) =>
    ctx.db.insert('calendars', {
      groupId,
      name: 'Ours',
      source: 'local',
      createdBy: userId,
    }),
  )
  for (let index = 0; index < LARGE_ROWS; index += 1)
    await t.run((ctx) =>
      ctx.db.insert('calendarEvents', {
        calendarId,
        title: `Event ${index}`,
        notes: LARGE,
        date: '2026-01-01',
        createdBy: userId,
      }),
    )

  await me.mutation(api.calendar.removeCalendar, {
    groupSlug: 'home',
    id: calendarId,
  })
  expect(await t.run((ctx) => ctx.db.get(calendarId))).toBe(null)
  expect(await settle(t)).toBeGreaterThan(1)
  expect(await count(t, 'calendarEvents')).toBe(0)
}, 60_000)

test('a child with hundreds of photos goes, and so do the photos', async () => {
  const { t, me, userId, groupId } = await household()
  // About 512 photos released in one transaction pass its index ranges.
  const PHOTOS = 600
  const { babyId, photoId, eventPhotos } = await t.run(async (ctx) => {
    const photoId = await ctx.storage.store(new Blob(['child']))
    const babyId = await ctx.db.insert('babies', {
      groupId,
      name: 'Mila',
      birthDate: '2026-01-01',
      order: 0,
      photoId,
    })
    const eventPhotos: Id<'_storage'>[] = []
    for (let index = 0; index < PHOTOS; index += 1) {
      const photo = await ctx.storage.store(new Blob([`memory ${index}`]))
      eventPhotos.push(photo)
      await ctx.db.insert('babyEvents', {
        babyId,
        type: 'note',
        photoId: photo,
        timestamp: index,
        loggedBy: userId,
        data: {},
      })
    }
    return { babyId, photoId, eventPhotos }
  })

  await me.mutation(api.babies.remove, { id: babyId, groupSlug: 'home' })
  expect(await t.run((ctx) => ctx.db.get(babyId))).toBe(null)
  expect(await settle(t)).toBeGreaterThan(0)

  expect(await count(t, 'babyEvents')).toBe(0)
  const left = await t.run(async (ctx) => {
    const urls = await Promise.all(
      [photoId, ...eventPhotos].map((id) => ctx.storage.getUrl(id)),
    )
    return urls.filter((url) => url !== null).length
  })
  expect(left).toBe(0)
}, 120_000)

test('a small list goes in the one transaction', async () => {
  const { t, me, userId, groupId } = await household()
  const listId = await t.run(async (ctx) => {
    const listId = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Chores',
      provider: 'local',
      order: 0,
    })
    await ctx.db.insert('tasks', {
      listId,
      title: 'Bins',
      done: false,
      createdBy: userId,
      order: 0,
    })
    return listId
  })
  await me.mutation(api.taskLists.remove, { listId, groupSlug: 'home' })
  expect(await count(t, 'tasks')).toBe(0)
  expect(await settle(t)).toBe(0)
})
