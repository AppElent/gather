import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'

/**
 * List kinds, faces and templates (APP-306), through the real functions.
 *
 * Alice is in both households and Bob only in De Vries, so every write is
 * checked against the Group the caller names, not against "some Group the
 * caller is in".
 */

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'

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
    const jansen = await seedGroup(ctx, {
      name: 'Jansen Household',
      slug: JANSEN,
      inviteCode: 'jansen',
    })
    const devries = await seedGroup(ctx, {
      name: 'De Vries Household',
      slug: DE_VRIES,
      inviteCode: 'devries',
    })
    await seedMember(ctx, jansen, aliceId, 'admin')
    await seedMember(ctx, devries, aliceId, 'member')
    await seedMember(ctx, devries, bobId, 'admin')
    // A list from before kinds existed: no kind, icon or colour.
    const oldList = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Old list',
      provider: 'local',
      order: 0,
    })
    const oldTask = await ctx.db.insert('tasks', {
      listId: oldList,
      title: 'Old task',
      done: false,
      createdBy: aliceId,
      order: 0,
    })
    return { jansen, devries, oldList, oldTask }
  })
  return { t, ...ids }
}

async function refusal(run: Promise<unknown>): Promise<string> {
  try {
    await run
    return 'no refusal'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

describe('a list made from a template', () => {
  test('stores its kind, icon and colour, and starts with its items in order', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    const listId = await as.mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Vakantie',
      provider: 'local',
      kind: 'packing',
      icon: 'suitcase',
      color: 'money',
      starterTasks: [' Regenjassen ', 'Truien', 'Knuffel'],
    })
    const lists = await as.query(api.taskLists.list, { groupSlug: JANSEN })
    expect(lists.find((list) => list._id === listId)).toMatchObject({
      name: 'Vakantie',
      kind: 'packing',
      icon: 'suitcase',
      color: 'money',
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    expect(tasks.map((task) => task.title)).toEqual([
      'Regenjassen',
      'Truien',
      'Knuffel',
    ])
    expect(tasks.every((task) => !task.done)).toBe(true)
  })

  test('a retry with the same key makes one list and one set of items', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    const args = {
      groupSlug: JANSEN,
      name: 'Huishouden',
      provider: 'local' as const,
      kind: 'chores' as const,
      starterTasks: ['Stofzuigen', 'Ramen lappen'],
      idempotencyKey: 'new-list-retry-1',
    }
    const first = await as.mutation(api.taskLists.create, args)
    const second = await as.mutation(api.taskLists.create, args)
    expect(second).toBe(first)
    const tasks = await as.query(api.tasks.listByList, {
      listId: first,
      groupSlug: JANSEN,
    })
    expect(tasks).toHaveLength(2)
  })

  test('a list called as before, without the new fields, still works', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    const listId = await as.mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Plain',
      provider: 'local',
    })
    const lists = await as.query(api.taskLists.list, { groupSlug: JANSEN })
    expect(lists.find((list) => list._id === listId)).toMatchObject({
      kind: 'plain',
      icon: null,
      color: null,
    })
  })

  test('lists from before kinds read as plain lists without a face', async () => {
    const { t, oldList } = await seed()
    const lists = await t
      .withIdentity(alice)
      .query(api.taskLists.list, { groupSlug: JANSEN })
    expect(lists.find((list) => list._id === oldList)).toMatchObject({
      kind: 'plain',
      icon: null,
      color: null,
    })
  })

  test('a groceries list becomes the Group’s grocery list', async () => {
    const { t, jansen } = await seed()
    const listId = await t.withIdentity(alice).mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Boodschappen',
      provider: 'local',
      kind: 'groceries',
    })
    const group = await t.run((ctx) => ctx.db.get(jansen))
    expect(group?.groceryListId).toBe(listId)
  })

  test('refuses starter items that are empty, too long or too many', async () => {
    const { t } = await seed()
    const as = t.withIdentity(alice)
    const make = (starterTasks: string[]) =>
      refusal(
        as.mutation(api.taskLists.create, {
          groupSlug: JANSEN,
          name: 'Bad',
          provider: 'local',
          starterTasks,
        }),
      )
    expect(await make(['  '])).toContain('A starter task needs a title')
    expect(await make(['x'.repeat(201)])).toContain(
      'A starter task needs a title',
    )
    expect(await make(Array.from({ length: 51 }, () => 'x'))).toContain(
      'Too many starter tasks',
    )
    // Nothing was written by the refused creates.
    const lists = await as.query(api.taskLists.list, { groupSlug: JANSEN })
    expect(lists.map((list) => list.name)).toEqual(['Old list'])
  })

  test('a non-member cannot make a list in a Group', async () => {
    const { t } = await seed()
    expect(
      await refusal(
        t.withIdentity(bob).mutation(api.taskLists.create, {
          groupSlug: JANSEN,
          name: 'Sneaky',
          provider: 'local',
          kind: 'chores',
          starterTasks: ['Stofzuigen'],
        }),
      ),
    ).not.toBe('no refusal')
  })
})

describe('a list’s colour and icon', () => {
  test('a Member changes them', async () => {
    const { t, oldList } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.taskLists.setAppearance, {
      listId: oldList,
      groupSlug: JANSEN,
      color: 'tasting',
    })
    await as.mutation(api.taskLists.setAppearance, {
      listId: oldList,
      groupSlug: JANSEN,
      icon: 'gift',
    })
    const lists = await as.query(api.taskLists.list, { groupSlug: JANSEN })
    expect(lists.find((list) => list._id === oldList)).toMatchObject({
      icon: 'gift',
      color: 'tasting',
    })
  })

  test('only through the Group the list belongs to', async () => {
    const { t, oldList } = await seed()
    // Alice is in De Vries too, but the list is Jansen's.
    expect(
      await refusal(
        t.withIdentity(alice).mutation(api.taskLists.setAppearance, {
          listId: oldList,
          groupSlug: DE_VRIES,
          color: 'money',
        }),
      ),
    ).toContain('List not found')
    expect(
      await refusal(
        t.withIdentity(bob).mutation(api.taskLists.setAppearance, {
          listId: oldList,
          groupSlug: JANSEN,
          color: 'money',
        }),
      ),
    ).not.toBe('no refusal')
  })
})

describe('Uncheck all', () => {
  async function packing() {
    const seeded = await seed()
    const as = seeded.t.withIdentity(alice)
    const listId = await as.mutation(api.taskLists.create, {
      groupSlug: JANSEN,
      name: 'Trip',
      provider: 'local',
      kind: 'packing',
      starterTasks: ['Socks', 'Shampoo', 'Snacks'],
    })
    const tasks = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    return { ...seeded, as, listId, tasks }
  }

  test('unchecks every item, and the undo puts back exactly those', async () => {
    const { as, listId, tasks } = await packing()
    const [socks, shampoo, snacks] = tasks
    for (const task of [socks, shampoo]) {
      await as.mutation(api.tasks.toggleDone, {
        taskId: task._id,
        groupSlug: JANSEN,
      })
    }
    const changed = await as.mutation(api.tasks.setDoneInList, {
      listId,
      groupSlug: JANSEN,
      done: false,
    })
    expect(new Set(changed)).toEqual(new Set([socks._id, shampoo._id]))
    let rows = await as.query(api.tasks.listByList, {
      listId,
      groupSlug: JANSEN,
    })
    expect(rows.every((task) => !task.done)).toBe(true)

    await as.mutation(api.tasks.setDoneInList, {
      listId,
      groupSlug: JANSEN,
      done: true,
      taskIds: changed,
    })
    rows = await as.query(api.tasks.listByList, { listId, groupSlug: JANSEN })
    const done = new Map(rows.map((task) => [task._id, task.done]))
    expect(done.get(socks._id)).toBe(true)
    expect(done.get(shampoo._id)).toBe(true)
    expect(done.get(snacks._id)).toBe(false)
  })

  test('refuses a task from another list, and another Group', async () => {
    const { t, as, listId, oldTask } = await packing()
    expect(
      await refusal(
        as.mutation(api.tasks.setDoneInList, {
          listId,
          groupSlug: JANSEN,
          done: true,
          taskIds: [oldTask],
        }),
      ),
    ).toContain('Task not found')
    expect(
      await refusal(
        t.withIdentity(bob).mutation(api.tasks.setDoneInList, {
          listId,
          groupSlug: JANSEN,
          done: false,
        }),
      ),
    ).not.toBe('no refusal')
    expect(
      await refusal(
        as.mutation(api.tasks.setDoneInList, {
          listId,
          groupSlug: DE_VRIES,
          done: false,
        }),
      ),
    ).toContain('List not found')
  })
})

describe('a wishlist item’s link and price', () => {
  test('stores a web link and a price, and clears them', async () => {
    const { t, oldTask } = await seed()
    const as = t.withIdentity(alice)
    await as.mutation(api.tasks.update, {
      taskId: oldTask,
      groupSlug: JANSEN,
      url: 'bol.com/p/123',
      priceCents: 2495,
    })
    let task = await t.run((ctx) => ctx.db.get(oldTask))
    expect(task).toMatchObject({
      url: 'https://bol.com/p/123',
      priceCents: 2495,
    })
    await as.mutation(api.tasks.update, {
      taskId: oldTask,
      groupSlug: JANSEN,
      url: null,
      priceCents: null,
    })
    task = await t.run((ctx) => ctx.db.get(oldTask))
    expect(task?.url).toBeUndefined()
    expect(task?.priceCents).toBeUndefined()
  })

  test('refuses a link that is not http or https, and a price that is not one', async () => {
    const { t, oldTask } = await seed()
    const as = t.withIdentity(alice)
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'nope']) {
      expect(
        await refusal(
          as.mutation(api.tasks.update, {
            taskId: oldTask,
            groupSlug: JANSEN,
            url,
          }),
        ),
      ).toContain('That is not a web address')
    }
    for (const priceCents of [-1, 1.5, 1e12]) {
      expect(
        await refusal(
          as.mutation(api.tasks.update, {
            taskId: oldTask,
            groupSlug: JANSEN,
            priceCents,
          }),
        ),
      ).toContain('That is not a price')
    }
    const task = await t.run((ctx) => ctx.db.get(oldTask))
    expect(task?.url).toBeUndefined()
  })
})
