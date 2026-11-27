import { describe, expect, test } from 'vitest'
import {
  alice,
  bob,
  seedGroup,
  seedMember,
  testConvex,
} from '../test/convexHarness'
import { api } from './_generated/api'
import { completionDay } from './lib/taskRepeat'

/**
 * The Tasks index's counts (APP-430), through the real function: one answer
 * for every local list instead of a subscription to each list's rows.
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
    const list = (groupId: typeof jansen, name: string, extra = {}) =>
      ctx.db.insert('taskLists', {
        groupId,
        name,
        provider: 'local',
        order: 0,
        ...extra,
      })
    const house = await list(jansen, 'House', { kind: 'chores' })
    const packing = await list(jansen, 'Trip', { kind: 'packing' })
    const groceries = await list(jansen, 'Shop', { kind: 'groceries' })
    const empty = await list(jansen, 'Empty')
    const linked = await ctx.db.insert('taskLists', {
      groupId: jansen,
      name: 'Work',
      provider: 'todoist',
      order: 2,
    })
    const theirs = await list(devries, 'Theirs')
    let order = 0
    const task = (listId: typeof house, title: string, extra = {}) =>
      ctx.db.insert('tasks', {
        listId,
        title,
        done: false,
        createdBy: aliceId,
        order: order++,
        ...extra,
      })
    await task(house, 'Bins')
    await task(house, 'Plants')
    await task(house, 'Checked', { done: true, doneAt: 1 })
    const parent = await task(house, 'Parent')
    await task(house, 'Step one', { parentTaskId: parent })
    await task(house, 'Step two', { parentTaskId: parent, done: true })
    await task(packing, 'Sunscreen', { done: true, doneAt: 1 })
    await task(packing, 'Passports')
    await task(packing, 'Towels')
    const trip = await task(packing, 'Bag')
    await task(packing, 'Strap', { parentTaskId: trip, done: true })
    await task(groceries, 'Milk')
    for (let i = 0; i < 5; i++) {
      await task(groceries, `Old ${i}`, { done: true, doneAt: 1 })
    }
    // A linked list has no rows in Convex; this one must never be counted.
    await task(linked, 'Stray row')
    await task(theirs, 'Their task')
    return { house, packing, groceries, empty, linked, theirs }
  })
  return { t, ...ids }
}

describe('tasks.openCounts', () => {
  test('counts each local list, top-level tasks only', async () => {
    const { t, house, packing, groceries, empty, linked } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.openCounts, { groupSlug: JANSEN })
    const of = (id: string) => answer.find((row) => row.listId === id)
    // Parent, Bins and Plants: the subtasks are steps, the checked row is done.
    expect(of(house)).toEqual({ listId: house, open: 3 })
    // Checked grocery rows are not counted, and not read.
    expect(of(groceries)).toEqual({ listId: groceries, open: 1 })
    expect(of(empty)).toEqual({ listId: empty, open: 0 })
    // A linked list is the provider's to count.
    expect(of(linked)).toBeUndefined()
    expect(answer).toHaveLength(4)
    expect(of(packing)).toBeDefined()
  })

  test('a repeating grocery item checked off is not open until it is due (APP-520)', async () => {
    const { t, house, groceries } = await seed()
    const as = t.withIdentity(alice)
    const today = completionDay(undefined)
    const repeat = { mode: 'afterDone', every: 1, unit: 'week' } as const
    const [coffee, bins] = await t.run(async (ctx) => {
      const createdBy = (await ctx.db.query('users').first())!._id
      return await Promise.all(
        [groceries, house].map((listId, order) =>
          ctx.db.insert('tasks', {
            listId,
            title: order === 0 ? 'Coffee' : 'Mop',
            done: false,
            createdBy,
            order: 100 + order,
            dueDate: today,
            repeat,
          }),
        ),
      )
    })
    const count = async (id: string) =>
      (
        await as.query(api.tasks.openCounts, { groupSlug: JANSEN })
      ).find((row) => row.listId === id)?.open
    // Due today: on the list, Milk and Coffee.
    expect(await count(groceries)).toBe(2)
    for (const taskId of [coffee, bins]) {
      await as.mutation(api.tasks.toggleDone, {
        taskId,
        groupSlug: JANSEN,
        today,
      })
    }
    // Coffee moved on a week and stays open, but waits off the grocery list.
    const moved = await t.run((ctx) => ctx.db.get(coffee))
    expect(moved).toMatchObject({ done: false })
    expect(moved?.dueDate).not.toBe(today)
    expect(await count(groceries)).toBe(1)
    // A repeating chore on a list of tasks still counts as open.
    expect(await count(house)).toBe(4)
  })

  test('a packing list says how much is packed', async () => {
    const { t, packing } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.openCounts, { groupSlug: JANSEN })
    // Sunscreen is packed; Passports, Towels and Bag are not; the strap is a
    // subtask of the bag.
    expect(answer.find((row) => row.listId === packing)).toEqual({
      listId: packing,
      open: 3,
      done: 1,
      total: 4,
    })
  })

  test("another Group's lists are not visible", async () => {
    const { t, theirs } = await seed()
    const answer = await t
      .withIdentity(bob)
      .query(api.tasks.openCounts, { groupSlug: DE_VRIES })
    expect(answer).toEqual([{ listId: theirs, open: 1 }])
    const jansen = await t
      .withIdentity(alice)
      .query(api.tasks.openCounts, { groupSlug: JANSEN })
    expect(jansen.some((row) => row.listId === theirs)).toBe(false)
  })

  test('refuses a Group the caller is not in', async () => {
    const { t } = await seed()
    await expect(
      t
        .withIdentity(bob)
        .query(api.tasks.openCounts, { groupSlug: JANSEN }),
    ).rejects.toThrow('Not a member of that group')
  })
})
