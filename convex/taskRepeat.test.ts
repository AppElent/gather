import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alice, bob, seedGroup, seedMember, testConvex } from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Repeating tasks (APP-303), through the real mutations: completing moves the
 * due date on and keeps one open occurrence, every completion is a history
 * row, and undo puts both back.
 */

const JANSEN = 'jansen'
const DE_VRIES = 'de-vries'
// Thursday 19 November 2026, 11:00 in Amsterdam.
const NOW = Date.UTC(2026, 10, 19, 10, 0)
const TODAY = '2026-11-19'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

async function seed() {
  const t = testConvex()
  const ids = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert('users', {
      clerkId: alice.subject,
      name: 'Alice',
      email: alice.email,
    })
    const bobId = await ctx.db.insert('users', {
      clerkId: bob.subject,
      name: 'Bob',
      email: bob.email,
    })
    const jansen = await seedGroup(ctx, { name: 'Jansen', slug: JANSEN })
    const devries = await seedGroup(ctx, { name: 'De Vries', slug: DE_VRIES })
    await seedMember(ctx, jansen, aliceId, 'admin')
    await seedMember(ctx, jansen, bobId)
    await seedMember(ctx, devries, bobId, 'admin')
    return { aliceId, bobId, jansen, devries }
  })
  const listId = await t.withIdentity(alice).mutation(api.taskLists.create, {
    groupSlug: JANSEN,
    name: 'Huishouden',
    provider: 'local',
  })
  return { t, listId, ...ids }
}

type Harness = Awaited<ReturnType<typeof seed>>['t']

async function taskRow(t: Harness, taskId: Id<'tasks'>) {
  return await t.run(async (ctx) => await ctx.db.get(taskId))
}

async function historyRows(t: Harness, taskId: Id<'tasks'>) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query('taskCompletions')
        .withIndex('by_task', (q) => q.eq('taskId', taskId))
        .collect(),
  )
}

describe('a fixed schedule', () => {
  test('completing moves to the next date, stays open, and records who', async () => {
    const { t, listId, bobId } = await seed()
    // Bins out every Saturday, due this Saturday.
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Kliko aan de straat',
      dueDate: '2026-11-21',
      repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [6] },
    })

    // Bob does it early, on Thursday: next Saturday, not this one.
    const done = await t
      .withIdentity(bob)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    expect(done?.dueDate).toBe('2026-11-28')

    const row = await taskRow(t, taskId)
    expect(row).toMatchObject({ done: false, dueDate: '2026-11-28' })
    // One open occurrence: still one task on the list.
    const open = await t
      .withIdentity(alice)
      .query(api.tasks.listByList, { listId, groupSlug: JANSEN })
    expect(open).toHaveLength(1)

    const history = await historyRows(t, taskId)
    expect(history).toEqual([
      expect.objectContaining({
        completedBy: bobId,
        completedOn: TODAY,
        completedAt: expect.closeTo(NOW, -1),
        previousDueDate: '2026-11-21',
        nextDueDate: '2026-11-28',
      }),
    ])
    const shown = await t
      .withIdentity(alice)
      .query(api.tasks.completions, { taskId, groupSlug: JANSEN })
    expect(shown).toEqual([
      expect.objectContaining({ byName: 'Bob', completedOn: TODAY }),
    ])
  })

  test('a fixed rule without a due date starts on its first day', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Huur overmaken',
      repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
      today: TODAY,
    })
    expect(await taskRow(t, taskId)).toMatchObject({
      dueDate: '2026-11-30',
      repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
    })
    await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    // Back on the 31st once the month has one.
    expect((await taskRow(t, taskId))?.dueDate).toBe('2026-12-31')
  })

  test('completing late skips to a future date', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Plantjes',
      dueDate: '2026-11-03',
      repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [2] },
    })
    await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    expect((await taskRow(t, taskId))?.dueDate).toBe('2026-11-24')
  })
})

describe('after done', () => {
  test('counts from the completion day', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Vaatwasser ontkalken',
      dueDate: '2026-10-01',
      repeat: { mode: 'afterDone', unit: 'month', every: 3 },
    })
    await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    expect((await taskRow(t, taskId))?.dueDate).toBe('2027-02-19')
  })
})

describe('undo', () => {
  test('restores the previous date and removes the history row', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Koelkast',
      dueDate: '2026-11-20',
      repeat: { mode: 'afterDone', unit: 'day', every: 3 },
    })
    const done = await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    expect(done?.dueDate).toBe('2026-11-22')

    await t.withIdentity(alice).mutation(api.tasks.undoCompletion, {
      completionId: done!.completionId,
      groupSlug: JANSEN,
    })
    expect(await taskRow(t, taskId)).toMatchObject({
      done: false,
      dueDate: '2026-11-20',
    })
    expect(await historyRows(t, taskId)).toEqual([])
  })

  test('restores a task that had no due date to none', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Filter',
      repeat: { mode: 'afterDone', unit: 'week', every: 1 },
    })
    const done = await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    expect(done?.dueDate).toBe('2026-11-26')
    await t.withIdentity(alice).mutation(api.tasks.undoCompletion, {
      completionId: done!.completionId,
      groupSlug: JANSEN,
    })
    expect((await taskRow(t, taskId))?.dueDate).toBeUndefined()
  })

  test('only the latest completion can be undone', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Stofzuigen',
      dueDate: '2026-11-19',
      repeat: { mode: 'fixed', unit: 'day', every: 1 },
    })
    const first = await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    await t
      .withIdentity(bob)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    await expect(
      t.withIdentity(alice).mutation(api.tasks.undoCompletion, {
        completionId: first!.completionId,
        groupSlug: JANSEN,
      }),
    ).rejects.toThrow('Nothing to undo')
    expect(await historyRows(t, taskId)).toHaveLength(2)
  })

  test("another Group cannot undo, nor read the history", async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Ramen',
      dueDate: '2026-11-19',
      repeat: { mode: 'fixed', unit: 'day', every: 2 },
    })
    const done = await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    // Bob is in both Groups, and names the other one.
    await expect(
      t.withIdentity(bob).mutation(api.tasks.undoCompletion, {
        completionId: done!.completionId,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow('Task not found')
    await expect(
      t
        .withIdentity(bob)
        .query(api.tasks.completions, { taskId, groupSlug: DE_VRIES }),
    ).rejects.toThrow('Task not found')
  })
})

describe('every completion path', () => {
  test('update done:true completes the occurrence, once per due date seen', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Handdoeken',
      dueDate: '2026-11-22',
      repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [7] },
    })
    const update = () =>
      t.withIdentity(alice).mutation(api.tasks.update, {
        taskId,
        groupSlug: JANSEN,
        done: true,
        occurrence: '2026-11-22',
      })
    expect((await update())?.dueDate).toBe('2026-11-29')
    // A connected app retrying the same write completes nothing more.
    expect(await update()).toBeNull()
    expect(await taskRow(t, taskId)).toMatchObject({
      done: false,
      dueDate: '2026-11-29',
    })
    expect(await historyRows(t, taskId)).toHaveLength(1)
  })

  test('an installed app that sends no day gets the Dutch day', async () => {
    const { t, listId } = await seed()
    vi.setSystemTime(Date.UTC(2026, 10, 19, 23, 30)) // 00:30 on the 20th
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Kliko',
      dueDate: '2026-11-10',
      repeat: { mode: 'afterDone', unit: 'day', every: 1 },
    })
    await t
      .withIdentity(alice)
      .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN })
    expect((await taskRow(t, taskId))?.dueDate).toBe('2026-11-21')
  })

  test('a day far from the server’s is ignored', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Kliko',
      repeat: { mode: 'afterDone', unit: 'day', every: 1 },
    })
    await t.withIdentity(alice).mutation(api.tasks.toggleDone, {
      taskId,
      groupSlug: JANSEN,
      today: '2030-01-01',
    })
    expect((await taskRow(t, taskId))?.dueDate).toBe('2026-11-20')
  })

  test('a task that does not repeat still just ticks and unticks', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Eenmalig',
      dueDate: '2026-11-21',
    })
    expect(
      await t
        .withIdentity(alice)
        .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN }),
    ).toBeNull()
    expect(await taskRow(t, taskId)).toMatchObject({
      done: true,
      dueDate: '2026-11-21',
    })
    expect(await historyRows(t, taskId)).toEqual([])
  })
})

describe('setting and changing a repeat', () => {
  test('update sets, re-anchors and stops a repeat', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Huur',
      dueDate: '2026-11-30',
    })
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      repeat: { mode: 'fixed', unit: 'month', every: 1 },
    })
    expect((await taskRow(t, taskId))?.repeat).toEqual({
      mode: 'fixed',
      unit: 'month',
      every: 1,
      monthDay: 30,
    })
    // Moving the date moves the day of the month with it.
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      dueDate: '2026-12-01',
    })
    expect((await taskRow(t, taskId))?.repeat?.monthDay).toBe(1)
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      repeat: null,
    })
    expect((await taskRow(t, taskId))?.repeat).toBeUndefined()
  })

  test('the same due date sent again keeps a rule on the 31st', async () => {
    const { t, listId } = await seed()
    const taskId = await t.withIdentity(alice).mutation(api.tasks.add, {
      listId,
      groupSlug: JANSEN,
      title: 'Huur',
      dueDate: '2026-11-30',
    })
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
    })
    // A date sheet confirmed unchanged, or an agent echoing what it read.
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      dueDate: '2026-11-30',
    })
    expect(await taskRow(t, taskId)).toMatchObject({
      dueDate: '2026-11-30',
      repeat: { monthDay: 31 },
    })
    await t.withIdentity(alice).mutation(api.tasks.update, {
      taskId,
      groupSlug: JANSEN,
      dueDate: '2026-12-15',
    })
    expect((await taskRow(t, taskId))?.repeat?.monthDay).toBe(15)
  })

  test('a rule that cannot repeat is refused', async () => {
    const { t, listId } = await seed()
    await expect(
      t.withIdentity(alice).mutation(api.tasks.add, {
        listId,
        groupSlug: JANSEN,
        title: 'Nooit',
        repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [] },
      }),
    ).rejects.toThrow('That is not a repeat')
    await expect(
      t.withIdentity(alice).mutation(api.tasks.add, {
        listId,
        groupSlug: JANSEN,
        title: 'Nooit',
        repeat: { mode: 'afterDone', unit: 'year', every: 1 },
      }),
    ).rejects.toThrow('That is not a repeat')
  })
})

describe('history goes with its task', () => {
  test('deleting the task, or its list, deletes its completions', async () => {
    const { t, listId } = await seed()
    const add = (title: string) =>
      t.withIdentity(alice).mutation(api.tasks.add, {
        listId,
        groupSlug: JANSEN,
        title,
        dueDate: '2026-11-19',
        repeat: { mode: 'fixed', unit: 'day', every: 1 },
      })
    const one = await add('Een')
    const two = await add('Twee')
    for (const taskId of [one, two]) {
      await t
        .withIdentity(alice)
        .mutation(api.tasks.toggleDone, { taskId, groupSlug: JANSEN, today: TODAY })
    }
    await t
      .withIdentity(alice)
      .mutation(api.tasks.remove, { taskId: one, groupSlug: JANSEN })
    expect(await historyRows(t, one)).toEqual([])
    expect(await historyRows(t, two)).toHaveLength(1)

    await t
      .withIdentity(alice)
      .mutation(api.taskLists.remove, { listId, groupSlug: JANSEN })
    expect(await historyRows(t, two)).toEqual([])
  })
})
