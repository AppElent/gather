import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

/**
 * Subtasks, one level deep (APP-304), through the real mutations: the parent
 * rules on every write, "Complete all" and "Only this", a repeating parent's
 * reset and its undo, the delete that takes subtasks along, and the Group and
 * list checks on `parentTaskId`.
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

const refused = (code: string) => ({ data: { kind: `tasks:${code}` } })

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
    return { aliceId, bobId }
  })
  const as = t.withIdentity(alice)
  const listId = await as.mutation(api.taskLists.create, {
    groupSlug: JANSEN,
    name: 'Huishouden',
    provider: 'local',
  })
  const otherListId = await as.mutation(api.taskLists.create, {
    groupSlug: JANSEN,
    name: 'Klussen',
    provider: 'local',
  })
  const add = (title: string, extra: Record<string, unknown> = {}) =>
    as.mutation(api.tasks.add, { listId, groupSlug: JANSEN, title, ...extra })
  const attic = await add('Zolder opruimen')
  const boxes = await add('Dozen sorteren', { parentTaskId: attic })
  const sweep = await add('Vegen', { parentTaskId: attic })
  const tip = await add('Naar de stort', { parentTaskId: attic })
  return {
    t,
    as,
    add,
    listId,
    otherListId,
    attic,
    subtasks: [boxes, sweep, tip],
    ...ids,
  }
}

type Harness = Awaited<ReturnType<typeof seed>>['t']

const row = (t: Harness, id: Id<'tasks'>) =>
  t.run(async (ctx) => await ctx.db.get(id))

const doneOf = async (t: Harness, ids: Id<'tasks'>[]) =>
  Promise.all(ids.map(async (id) => (await row(t, id))?.done))

describe('adding a subtask', () => {
  test('is a whole task on its parent’s list, with its own assignee and date', async () => {
    const { t, add, attic, bobId, listId } = await seed()
    const id = await add('Lamp vervangen', {
      parentTaskId: attic,
      assigneeId: bobId,
      dueDate: '2026-11-21',
    })
    expect(await row(t, id)).toMatchObject({
      listId,
      parentTaskId: attic,
      assigneeId: bobId,
      dueDate: '2026-11-21',
      done: false,
    })
  })

  test('cannot have subtasks of its own', async () => {
    const { add, subtasks } = await seed()
    await expect(
      add('Te diep', { parentTaskId: subtasks[0] }),
    ).rejects.toMatchObject(refused('subtask-depth'))
  })

  test('sits on its parent’s list', async () => {
    const { as, attic, otherListId } = await seed()
    await expect(
      as.mutation(api.tasks.add, {
        listId: otherListId,
        groupSlug: JANSEN,
        title: 'Elders',
        parentTaskId: attic,
      }),
    ).rejects.toMatchObject(refused('subtask-list'))
  })

  test('does not repeat on its own', async () => {
    const { add, attic } = await seed()
    await expect(
      add('Elke week', {
        parentTaskId: attic,
        repeat: { mode: 'fixed', unit: 'week', every: 1 },
      }),
    ).rejects.toMatchObject(refused('subtask-repeat'))
  })

  test('a parent in another Group is not found, even to a Member of both', async () => {
    const { t, attic } = await seed()
    const theirs = await t.withIdentity(bob).mutation(api.taskLists.create, {
      groupSlug: DE_VRIES,
      name: 'Hun lijst',
      provider: 'local',
    })
    await expect(
      t.withIdentity(bob).mutation(api.tasks.add, {
        listId: theirs,
        groupSlug: DE_VRIES,
        title: 'Inbreker',
        parentTaskId: attic,
      }),
    ).rejects.toMatchObject(refused('not-found'))
  })
})

describe('changing the parent', () => {
  test('a task with subtasks cannot become a subtask', async () => {
    const { as, add, attic } = await seed()
    const other = await add('Schuur')
    await expect(
      as.mutation(api.tasks.update, {
        taskId: attic,
        groupSlug: JANSEN,
        parentTaskId: other,
      }),
    ).rejects.toMatchObject(refused('subtask-depth'))
  })

  test('nor can a task be its own parent', async () => {
    const { as, add } = await seed()
    const loner = await add('Alleen')
    await expect(
      as.mutation(api.tasks.update, {
        taskId: loner,
        groupSlug: JANSEN,
        parentTaskId: loner,
      }),
    ).rejects.toMatchObject(refused('subtask-depth'))
  })

  test('a repeating task cannot become a subtask, nor a subtask repeat', async () => {
    const { as, add, attic, subtasks } = await seed()
    const bins = await add('Kliko', {
      dueDate: '2026-11-21',
      repeat: { mode: 'fixed', unit: 'week', every: 1 },
    })
    await expect(
      as.mutation(api.tasks.update, {
        taskId: bins,
        groupSlug: JANSEN,
        parentTaskId: attic,
      }),
    ).rejects.toMatchObject(refused('subtask-repeat'))
    await expect(
      as.mutation(api.tasks.update, {
        taskId: subtasks[0],
        groupSlug: JANSEN,
        repeat: { mode: 'afterDone', unit: 'day', every: 3 },
      }),
    ).rejects.toMatchObject(refused('subtask-repeat'))
  })

  test('null makes a subtask a task of its own again', async () => {
    const { t, as, subtasks } = await seed()
    await as.mutation(api.tasks.update, {
      taskId: subtasks[0],
      groupSlug: JANSEN,
      parentTaskId: null,
    })
    expect((await row(t, subtasks[0]))?.parentTaskId).toBeUndefined()
  })
})

describe('completing a parent with open subtasks', () => {
  test('"Complete all" checks the open subtasks too', async () => {
    const { t, as, attic, subtasks } = await seed()
    await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
      withSubtasks: true,
    })
    expect((await row(t, attic))?.done).toBe(true)
    expect(await doneOf(t, subtasks)).toEqual([true, true, true])
  })

  test('"Only this" — and an app from before subtasks — leaves them open', async () => {
    const { t, as, attic, subtasks } = await seed()
    await as.mutation(api.tasks.toggleDone, { taskId: attic, groupSlug: JANSEN })
    expect((await row(t, attic))?.done).toBe(true)
    expect(await doneOf(t, subtasks)).toEqual([false, false, false])
  })

  test('update done with withSubtasks checks them too (MCP)', async () => {
    const { t, as, attic, subtasks } = await seed()
    await as.mutation(api.tasks.update, {
      taskId: attic,
      groupSlug: JANSEN,
      done: true,
      withSubtasks: true,
    })
    expect(await doneOf(t, subtasks)).toEqual([true, true, true])
  })
})

describe('a repeating parent', () => {
  async function repeating() {
    const s = await seed()
    await s.as.mutation(api.tasks.update, {
      taskId: s.attic,
      groupSlug: JANSEN,
      dueDate: '2026-11-21',
      repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [6] },
      today: TODAY,
    })
    // Two of the three steps are done this week.
    for (const id of s.subtasks.slice(0, 2)) {
      await s.as.mutation(api.tasks.toggleDone, { taskId: id, groupSlug: JANSEN })
    }
    return s
  }

  test('reopens its subtasks when it moves on', async () => {
    const { t, as, attic, subtasks } = await repeating()
    const done = await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
      today: TODAY,
    })
    expect(done?.dueDate).toBe('2026-11-28')
    expect(await doneOf(t, subtasks)).toEqual([false, false, false])
  })

  // Neither app asks "Only this" here (APP-940, contracts/tasks.md): every
  // occurrence starts with its subtasks open, however the last one ended.
  test('every next occurrence starts with its subtasks open', async () => {
    const { t, as, attic, subtasks } = await repeating()
    const complete = () =>
      as.mutation(api.tasks.toggleDone, {
        taskId: attic,
        groupSlug: JANSEN,
        today: TODAY,
      })
    expect((await complete())?.dueDate).toBe('2026-11-28')
    // This week's occurrence: one step done, then the parent again.
    await as.mutation(api.tasks.toggleDone, {
      taskId: subtasks[2],
      groupSlug: JANSEN,
    })
    expect(await doneOf(t, subtasks)).toEqual([false, false, true])
    expect((await complete())?.dueDate).toBe('2026-12-05')
    expect(await doneOf(t, subtasks)).toEqual([false, false, false])
    expect(await row(t, attic)).toMatchObject({ done: false })
  })

  test('undo of the completion checks the same subtasks again', async () => {
    const { t, as, attic, subtasks } = await repeating()
    const done = await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
      today: TODAY,
    })
    if (!done) throw new Error('expected a completion')
    await as.mutation(api.tasks.undoCompletion, {
      completionId: done.completionId,
      groupSlug: JANSEN,
    })
    expect(await row(t, attic)).toMatchObject({
      done: false,
      dueDate: '2026-11-21',
    })
    expect(await doneOf(t, subtasks)).toEqual([true, true, false])
  })

  test('"Complete all" on a repeating parent still leaves its subtasks open', async () => {
    const { t, as, attic, subtasks } = await repeating()
    await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
      today: TODAY,
      withSubtasks: true,
    })
    expect(await doneOf(t, subtasks)).toEqual([false, false, false])
  })
})

describe("a repeating parent's dated subtasks (APP-451)", () => {
  /** A repeating parent due `due`, with one subtask per date (null: none). */
  async function parentWith(
    due: string,
    repeat: Record<string, unknown>,
    dates: (string | null)[],
  ) {
    const s = await seed()
    const parent = await s.add('Dakgoot', { dueDate: due, repeat, today: TODAY })
    const steps: Id<'tasks'>[] = []
    for (const [i, date] of dates.entries()) {
      steps.push(
        await s.add(`Stap ${i}`, {
          parentTaskId: parent,
          ...(date ? { dueDate: date } : {}),
        }),
      )
    }
    const complete = async () => {
      const done = await s.as.mutation(api.tasks.toggleDone, {
        taskId: parent,
        groupSlug: JANSEN,
        today: TODAY,
      })
      if (!done) throw new Error('expected a completion')
      return done
    }
    const undo = (completionId: Id<'taskCompletions'>) =>
      s.as.mutation(api.tasks.undoCompletion, {
        completionId,
        groupSlug: JANSEN,
      })
    const datesOf = async () =>
      Promise.all(steps.map(async (id) => (await row(s.t, id))?.dueDate))
    return { ...s, parent, steps, complete, undo, datesOf }
  }

  const weekly = { mode: 'fixed', unit: 'week', every: 1, weekdays: [6] }

  test('move as many days as the parent, and undo moves them back', async () => {
    const p = await parentWith('2026-11-21', weekly, [
      '2026-11-20',
      null,
      '2026-11-21',
    ])
    const done = await p.complete()
    expect(done.dueDate).toBe('2026-11-28')
    expect(await p.datesOf()).toEqual(['2026-11-27', undefined, '2026-11-28'])

    await p.undo(done.completionId)
    expect((await row(p.t, p.parent))?.dueDate).toBe('2026-11-21')
    expect(await p.datesOf()).toEqual(['2026-11-20', undefined, '2026-11-21'])
  })

  test('a step that was already overdue moves too, from its own date', async () => {
    const p = await parentWith('2026-11-21', weekly, ['2026-11-10'])
    const done = await p.complete()
    expect(await p.datesOf()).toEqual(['2026-11-17'])
    await p.undo(done.completionId)
    expect(await p.datesOf()).toEqual(['2026-11-10'])
  })

  test('across a month end: the 31st to the end of February and back', async () => {
    const p = await parentWith(
      '2027-01-31',
      { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
      ['2027-01-30', '2027-01-31'],
    )
    const done = await p.complete()
    // The parent clamps to 28 February: 28 days on, so the steps move 28.
    expect(done.dueDate).toBe('2027-02-28')
    expect(await p.datesOf()).toEqual(['2027-02-27', '2027-02-28'])
    await p.undo(done.completionId)
    expect(await p.datesOf()).toEqual(['2027-01-30', '2027-01-31'])
  })

  test('over a month boundary into a longer month', async () => {
    const p = await parentWith(
      '2026-11-30',
      { mode: 'fixed', unit: 'month', every: 1, monthDay: 31 },
      ['2026-11-29'],
    )
    const done = await p.complete()
    expect(done.dueDate).toBe('2026-12-31')
    expect(await p.datesOf()).toEqual(['2026-12-30'])
    await p.undo(done.completionId)
    expect(await p.datesOf()).toEqual(['2026-11-29'])
  })

  test('across the switch to summer time, by calendar days, with its reminder', async () => {
    // Summer time starts in Amsterdam on Sunday 28 March 2027.
    const p = await parentWith('2027-03-27', weekly, ['2027-03-26'])
    const [step] = p.steps
    if (!step) throw new Error('expected a step')
    await p.as.mutation(api.tasks.setReminder, {
      taskId: step,
      groupSlug: JANSEN,
      reminder: {
        date: '2027-03-25',
        time: '09:00',
        timeZone: 'Europe/Amsterdam',
      },
    })
    const queuedAt = () =>
      p.t.run(async (ctx) =>
        (await ctx.db.query('scheduledNotifications').collect()).map(
          (n) => n.at,
        ),
      )
    // 09:00 in winter time is 08:00 UTC.
    expect(await queuedAt()).toEqual([Date.parse('2027-03-25T08:00:00Z')])

    const done = await p.complete()
    expect(done.dueDate).toBe('2027-04-03')
    expect(await row(p.t, step)).toMatchObject({
      dueDate: '2027-04-02',
      reminder: { date: '2027-04-01', time: '09:00' },
    })
    // Still 09:00 on the wall clock, now summer time: 07:00 UTC.
    expect(await queuedAt()).toEqual([Date.parse('2027-04-01T07:00:00Z')])

    await p.undo(done.completionId)
    expect(await row(p.t, step)).toMatchObject({
      dueDate: '2027-03-26',
      reminder: { date: '2027-03-25', time: '09:00' },
    })
    expect(await queuedAt()).toEqual([Date.parse('2027-03-25T08:00:00Z')])
  })

  test('undo leaves alone a dated step added after the completion', async () => {
    const p = await parentWith('2026-11-21', weekly, ['2026-11-20'])
    const done = await p.complete()
    const late = await p.add('Ladder terugbrengen', {
      parentTaskId: p.parent,
      dueDate: '2026-11-27',
    })
    await p.undo(done.completionId)
    expect(await p.datesOf()).toEqual(['2026-11-20'])
    expect((await row(p.t, late))?.dueDate).toBe('2026-11-27')
  })

  test('the first completion of an undated after-done parent moves no step', async () => {
    const s = await seed()
    const parent = await s.add('Filter vervangen', {
      repeat: { mode: 'afterDone', unit: 'week', every: 2 },
      today: TODAY,
    })
    const step = await s.add('Filter kopen', {
      parentTaskId: parent,
      dueDate: '2026-11-20',
    })
    const done = await s.as.mutation(api.tasks.toggleDone, {
      taskId: parent,
      groupSlug: JANSEN,
      today: TODAY,
    })
    expect(done?.dueDate).toBe('2026-12-03')
    expect((await row(s.t, step))?.dueDate).toBe('2026-11-20')
  })

  describe('when the parent’s due date is moved by hand (APP-468)', () => {
    type Seeded = Pick<Awaited<ReturnType<typeof seed>>, 't' | 'as'>
    const remindAt = (
      p: Seeded,
      taskId: Id<'tasks'>,
      date: string,
    ) =>
      p.as.mutation(api.tasks.setReminder, {
        taskId,
        groupSlug: JANSEN,
        reminder: { date, time: '09:00', timeZone: 'Europe/Amsterdam' },
      })
    const moveTo = (
      p: Seeded,
      taskId: Id<'tasks'>,
      dueDate: string | null,
    ) =>
      p.as.mutation(api.tasks.update, {
        taskId,
        groupSlug: JANSEN,
        dueDate,
        today: TODAY,
      })
    const queuedAt = (p: Seeded) =>
      p.t.run(async (ctx) =>
        (await ctx.db.query('scheduledNotifications').collect())
          .map((n) => n.at)
          .sort(),
      )

    test('a repeating parent takes its dated steps and their reminders along', async () => {
      const p = await parentWith('2026-11-21', weekly, [
        '2026-11-20',
        null,
        '2026-11-21',
      ])
      const [step] = p.steps
      if (!step) throw new Error('expected a step')
      await remindAt(p, p.parent, '2026-11-21')
      await remindAt(p, step, '2026-11-20')

      await moveTo(p, p.parent, '2026-11-24')
      expect(await p.datesOf()).toEqual(['2026-11-23', undefined, '2026-11-24'])
      expect((await row(p.t, p.parent))?.reminder).toMatchObject({
        date: '2026-11-24',
      })
      expect((await row(p.t, step))?.reminder).toMatchObject({
        date: '2026-11-23',
      })
      // 09:00 in Amsterdam is 08:00 UTC in November.
      expect(await queuedAt(p)).toEqual([
        Date.parse('2026-11-23T08:00:00Z'),
        Date.parse('2026-11-24T08:00:00Z'),
      ])

      // Back again, by fewer days than it went.
      await moveTo(p, p.parent, '2026-11-22')
      expect(await p.datesOf()).toEqual(['2026-11-21', undefined, '2026-11-22'])
    })

    test('a one-off parent leaves its steps’ dates alone; its own reminder still moves', async () => {
      const s = await seed()
      const parent = await s.add('Verhuizen', { dueDate: '2026-11-21' })
      const step = await s.add('Dozen halen', {
        parentTaskId: parent,
        dueDate: '2026-11-20',
      })
      await remindAt(s, parent, '2026-11-21')
      await remindAt(s, step, '2026-11-20')

      await moveTo(s, parent, '2026-11-24')
      expect(await row(s.t, step)).toMatchObject({
        dueDate: '2026-11-20',
        reminder: { date: '2026-11-20' },
      })
      expect((await row(s.t, parent))?.reminder).toMatchObject({
        date: '2026-11-24',
      })
    })

    test('clearing a repeating parent’s due date moves no step', async () => {
      const p = await parentWith('2026-11-21', weekly, ['2026-11-20'])
      await moveTo(p, p.parent, null)
      expect(await p.datesOf()).toEqual(['2026-11-20'])
    })
  })
})

describe('deleting', () => {
  test('a parent deletes its subtasks', async () => {
    const { t, as, attic, subtasks, listId } = await seed()
    await as.mutation(api.tasks.remove, { taskId: attic, groupSlug: JANSEN })
    for (const id of [attic, ...subtasks]) expect(await row(t, id)).toBeNull()
    const left = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    expect(left).toEqual([])
  })

  test('a subtask leaves its parent and siblings', async () => {
    const { t, as, attic, subtasks } = await seed()
    await as.mutation(api.tasks.remove, {
      taskId: subtasks[0],
      groupSlug: JANSEN,
    })
    expect(await row(t, attic)).not.toBeNull()
    expect(await row(t, subtasks[1])).not.toBeNull()
  })

  test('only a Member of the Group can delete', async () => {
    const { t, attic } = await seed()
    await expect(
      t.withIdentity(bob).mutation(api.tasks.remove, {
        taskId: attic,
        groupSlug: DE_VRIES,
      }),
    ).rejects.toThrow('Task not found')
  })
})

describe('reordering subtasks', () => {
  test('swaps their order values and leaves the rest of the list', async () => {
    const { t, as, add, attic, subtasks } = await seed()
    const after = await add('Daarna')
    const before = (await row(t, after))?.order
    const [boxes, sweep, tip] = subtasks
    await as.mutation(api.tasks.reorderSubtasks, {
      taskId: attic,
      groupSlug: JANSEN,
      ids: [tip, boxes, sweep],
    })
    const orders = await Promise.all(
      [tip, boxes, sweep].map(async (id) => (await row(t, id))?.order ?? 0),
    )
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect((await row(t, after))?.order).toBe(before)
  })

  test('needs every subtask once', async () => {
    const { as, attic, subtasks } = await seed()
    await expect(
      as.mutation(api.tasks.reorderSubtasks, {
        taskId: attic,
        groupSlug: JANSEN,
        ids: subtasks.slice(0, 2),
      }),
    ).rejects.toThrow('every subtask')
  })

  test('the list’s own reorder still takes every open task, subtasks included', async () => {
    const { as, add, attic, subtasks, listId } = await seed()
    const other = await add('Schuur')
    await as.mutation(api.tasks.reorder, {
      listId,
      groupSlug: JANSEN,
      ids: [other, attic, ...subtasks],
    })
    const rows = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    expect(rows.map((r) => r._id)).toEqual([other, attic, ...subtasks])
  })
})

describe('moving to another list', () => {
  test('a parent takes its subtasks along', async () => {
    const { t, as, attic, subtasks, otherListId } = await seed()
    await as.mutation(api.tasks.moveToList, {
      taskId: attic,
      groupSlug: JANSEN,
      listId: otherListId,
    })
    for (const id of subtasks) {
      expect(await row(t, id)).toMatchObject({
        listId: otherListId,
        parentTaskId: attic,
      })
    }
  })

  test('a subtask moved on its own becomes a task of its own', async () => {
    const { t, as, subtasks, otherListId } = await seed()
    await as.mutation(api.tasks.moveToList, {
      taskId: subtasks[0],
      groupSlug: JANSEN,
      listId: otherListId,
    })
    const moved = await row(t, subtasks[0])
    expect(moved?.listId).toBe(otherListId)
    expect(moved?.parentTaskId).toBeUndefined()
  })
})

describe('smart lists', () => {
  test('carry each parent’s progress and each subtask’s parent title', async () => {
    const { as, attic, subtasks, aliceId } = await seed()
    await as.mutation(api.tasks.update, {
      taskId: attic,
      groupSlug: JANSEN,
      assigneeId: aliceId,
    })
    await as.mutation(api.tasks.update, {
      taskId: subtasks[1],
      groupSlug: JANSEN,
      assigneeId: aliceId,
    })
    await as.mutation(api.tasks.toggleDone, {
      taskId: subtasks[0],
      groupSlug: JANSEN,
    })
    const answer = await as.query(api.tasks.smartLists, {
      groupSlug: JANSEN,
      today: TODAY,
    })
    expect(answer.subtasks).toEqual([{ taskId: attic, done: 1, total: 3 }])
    expect(answer.parents).toEqual([
      { taskId: attic, title: 'Zolder opruimen' },
    ])
  })
})

describe('grocery lists, sections and the remaining checks', () => {
  const groceryList = (as: Awaited<ReturnType<typeof seed>>['as']) =>
    as.mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Albert Heijn',
      provider: 'local',
      kind: 'groceries',
    })

  test('a grocery list has items, not subtasks', async () => {
    const { as } = await seed()
    const groceries = await groceryList(as)
    const milk = await as.mutation(api.tasks.add, {
      listId: groceries,
      groupSlug: JANSEN,
      title: 'Melk',
    })
    await expect(
      as.mutation(api.tasks.add, {
        listId: groceries,
        groupSlug: JANSEN,
        title: 'Halfvol',
        parentTaskId: milk,
      }),
    ).rejects.toMatchObject(refused('subtask-grocery'))
  })

  test('a parent moved onto a grocery list leaves its subtasks behind, as tasks of their own', async () => {
    const { t, as, attic, subtasks, listId } = await seed()
    const groceries = await groceryList(as)
    await as.mutation(api.tasks.moveToList, {
      taskId: attic,
      groupSlug: JANSEN,
      listId: groceries,
    })
    expect((await row(t, attic))?.listId).toBe(groceries)
    for (const id of subtasks) {
      const left = await row(t, id)
      expect(left?.listId).toBe(listId)
      expect(left?.parentTaskId).toBeUndefined()
    }
  })

  test('a parent on another list is refused when changing the parent', async () => {
    const { as, add, otherListId } = await seed()
    const elsewhere = await as.mutation(api.tasks.add, {
      listId: otherListId,
      groupSlug: JANSEN,
      title: 'Elders',
    })
    const loose = await add('Los')
    await expect(
      as.mutation(api.tasks.update, {
        taskId: loose,
        groupSlug: JANSEN,
        parentTaskId: elsewhere,
      }),
    ).rejects.toMatchObject(refused('subtask-list'))
  })

  test('a section move takes the subtasks along; a subtask cannot leave its parent’s section', async () => {
    const { t, as, attic, subtasks, listId } = await seed()
    const kitchen = await as.mutation(api.taskSections.add, {
      listId,
      groupSlug: JANSEN,
      name: 'Keuken',
    })
    await as.mutation(api.tasks.setSection, {
      taskId: attic,
      groupSlug: JANSEN,
      sectionId: kitchen,
    })
    for (const id of subtasks) {
      expect((await row(t, id))?.sectionId).toBe(kitchen)
    }
    await expect(
      as.mutation(api.tasks.setSection, {
        taskId: subtasks[0],
        groupSlug: JANSEN,
        sectionId: null,
      }),
    ).rejects.toMatchObject(refused('subtask-list'))
  })

  test('only a Member of the Group can reorder the subtasks', async () => {
    const { t, attic, subtasks } = await seed()
    await expect(
      t.withIdentity(bob).mutation(api.tasks.reorderSubtasks, {
        taskId: attic,
        groupSlug: DE_VRIES,
        ids: subtasks,
      }),
    ).rejects.toThrow('Task not found')
  })

  test('"Complete all" on a subtask or a done parent changes nothing else', async () => {
    const { t, as, attic, subtasks } = await seed()
    await as.mutation(api.tasks.toggleDone, {
      taskId: subtasks[0],
      groupSlug: JANSEN,
      withSubtasks: true,
    })
    expect(await doneOf(t, [attic, ...subtasks])).toEqual([
      false,
      true,
      false,
      false,
    ])
    await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
    })
    // Unchecking the parent with withSubtasks leaves its subtasks as they are.
    await as.mutation(api.tasks.toggleDone, {
      taskId: attic,
      groupSlug: JANSEN,
      withSubtasks: true,
    })
    expect(await doneOf(t, [attic, ...subtasks])).toEqual([
      false,
      true,
      false,
      false,
    ])
  })
})
