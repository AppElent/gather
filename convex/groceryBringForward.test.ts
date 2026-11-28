import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Adding a grocery item again while its repeating copy waits off the list for
 * its next date (APP-520) brings that copy forward to today, rather than a
 * second copy (APP-1000), as running low does for a staple (APP-989).
 */

const SLUG = 'jansen'

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: alice.name,
      email: alice.email,
    })
    const groupId = await seedGroup(ctx, { name: SLUG, slug: SLUG })
    await seedMember(ctx, groupId, aliceId, 'admin')
    const groceries = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Boodschappen',
      provider: 'local',
      order: 0,
    })
    const chores = await ctx.db.insert('taskLists', {
      groupId,
      name: 'Klusjes',
      provider: 'local',
      order: 1,
    })
    await ctx.db.patch(groupId, { groceryListId: groceries })
    return { aliceId, groceries, chores }
  })
  return { t, as: t.withIdentity(alice), ...ids }
}

type Seeded = Awaited<ReturnType<typeof seed>>

/** A weekly item, due `dueDate`, with one dated subtask. */
async function weekly(
  { t, aliceId }: Seeded,
  listId: Id<'taskLists'>,
  dueDate: string,
) {
  return await t.run(async (ctx) => {
    const item = await ctx.db.insert('tasks', {
      listId,
      title: 'Koffie',
      done: false,
      createdBy: aliceId,
      order: 0,
      dueDate,
      quantity: 1,
      unit: 'pak',
      repeat: { mode: 'fixed', unit: 'week', every: 1 },
    })
    const sub = await ctx.db.insert('tasks', {
      listId,
      parentTaskId: item,
      title: 'Bonen',
      done: false,
      createdBy: aliceId,
      order: 1,
      dueDate,
    })
    return { item, sub }
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('bringing a waiting grocery item forward', () => {
  test('a waiting item comes onto the list today, with its dated subtasks and its schedule', async () => {
    const seeded = await seed()
    const { t, as, groceries } = seeded
    const { item, sub } = await weekly(seeded, groceries, '2026-11-27')
    const before = await t.run((ctx) => ctx.db.get(item))
    expect(
      await as.mutation(api.tasks.bringForward, { groupSlug: SLUG, taskId: item }),
    ).toBe(true)
    const after = await t.run((ctx) => ctx.db.get(item))
    expect(after).toMatchObject({ done: false, dueDate: '2026-11-20', quantity: 1 })
    expect(after?.repeat).toEqual(before?.repeat)
    expect((await t.run((ctx) => ctx.db.get(sub)))?.dueDate).toBe('2026-11-20')
    // The amount typed then adds to it, as to any item on the list.
    await as.mutation(api.tasks.addAmount, {
      groupSlug: SLUG,
      taskId: item,
      quantity: 2,
      unit: 'pak',
    })
    expect((await t.run((ctx) => ctx.db.get(item)))?.quantity).toBe(3)
  })

  test('an item on the list today is left as it is', async () => {
    const seeded = await seed()
    const { t, as, groceries } = seeded
    const { item } = await weekly(seeded, groceries, '2026-11-18')
    expect(
      await as.mutation(api.tasks.bringForward, { groupSlug: SLUG, taskId: item }),
    ).toBe(false)
    expect((await t.run((ctx) => ctx.db.get(item)))?.dueDate).toBe('2026-11-18')
  })

  test('only on a grocery list, and only for Members', async () => {
    const seeded = await seed()
    const { t, as, chores, groceries } = seeded
    const { item: chore } = await weekly(seeded, chores, '2026-11-27')
    await expect(
      as.mutation(api.tasks.bringForward, { groupSlug: SLUG, taskId: chore }),
    ).rejects.toThrow()
    const { item } = await weekly(seeded, groceries, '2026-11-27')
    await t.run((ctx) =>
      ctx.db.insert('users', {
        clerkId: bob.subject,
        name: bob.name,
        email: bob.email,
      }),
    )
    await expect(
      t
        .withIdentity(bob)
        .mutation(api.tasks.bringForward, { groupSlug: SLUG, taskId: item }),
    ).rejects.toThrow()
    expect((await t.run((ctx) => ctx.db.get(item)))?.dueDate).toBe('2026-11-27')
  })
})
