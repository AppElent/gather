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
 * The two bounded reads behind the task detail screen and the Labels sheet
 * (APP-565), through the real functions: which list holds a task, and every
 * label typed in a Group, instead of a subscription to every list's rows.
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
    const house = await list(jansen, 'House')
    const groceries = await list(jansen, 'Shop', { kind: 'groceries' })
    const linked = await list(jansen, 'Work', { provider: 'todoist' })
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
    const bins = await task(house, 'Bins', { labels: ['outside', 'weekly'] })
    await task(house, 'Old', { done: true, labels: ['archive'] })
    await task(house, 'Plain')
    await task(groceries, 'Milk', { labels: ['dairy'] })
    await task(groceries, 'Checked', { done: true, labels: ['long-gone'] })
    await task(linked, 'Stray row', { labels: ['stray'] })
    const their = await task(theirs, 'Their task', { labels: ['private'] })
    return { house, bins, their }
  })
  return { t, ...ids }
}

describe('tasks.listOf', () => {
  test("names the task's own list", async () => {
    const { t, house, bins } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.listOf, { groupSlug: JANSEN, taskId: bins })
    expect(answer).toBe(house)
  })

  test("a linked list's id, a missing task and another Group's are null", async () => {
    const { t, their } = await seed()
    const as = t.withIdentity(alice)
    // A Todoist task's id is the provider's, never a Convex id.
    expect(
      await as.query(api.tasks.listOf, { groupSlug: JANSEN, taskId: '8812' }),
    ).toBeNull()
    // Alice is in both Groups, but the task is not in the one she named.
    expect(
      await as.query(api.tasks.listOf, { groupSlug: JANSEN, taskId: their }),
    ).toBeNull()
    await t.run((ctx) => ctx.db.delete(their))
    expect(
      await as.query(api.tasks.listOf, { groupSlug: DE_VRIES, taskId: their }),
    ).toBeNull()
  })

  test('refuses a Group the caller is not in', async () => {
    const { t, bins } = await seed()
    await expect(
      t
        .withIdentity(bob)
        .query(api.tasks.listOf, { groupSlug: JANSEN, taskId: bins }),
    ).rejects.toThrow('Not a member of that group')
  })
})

describe('tasks.labels', () => {
  test("every label on the Group's local lists, once, sorted", async () => {
    const { t } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.labels, { groupSlug: JANSEN })
    // A grocery list's checked items are not read; a linked list's rows are
    // the provider's; the other Group's labels stay there.
    expect(answer).toEqual(['archive', 'dairy', 'outside', 'weekly'])
  })

  test('refuses a Group the caller is not in', async () => {
    const { t } = await seed()
    await expect(
      t.withIdentity(bob).query(api.tasks.labels, { groupSlug: JANSEN }),
    ).rejects.toThrow('Not a member of that group')
  })
})
