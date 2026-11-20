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
