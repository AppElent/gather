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
 * The smart lists' one query (APP-301), through the real function.
 *
 * Alice is in both households and Bob only in De Vries. The rules themselves
 * are tested in `@gather/core/smart-lists`; this checks what the query reads
 * and who may read it.
 */

const JANSEN = 'jansen-household'
const DE_VRIES = 'de-vries-household'
const TODAY = '2026-11-18'

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
    await task(house, 'Late bins', { dueDate: '2026-11-17' })
    await task(house, 'Plants today', { dueDate: TODAY, assigneeId: bobId })
    await task(house, 'Rent in six days', {
      dueDate: '2026-11-24',
      assigneeId: bobId,
    })
    await task(house, 'Bob, someday', { assigneeId: bobId })
    await task(house, 'Alice, someday', { assigneeId: aliceId })
    await task(house, 'Nobody, someday')
    await task(house, 'Checked', {
      done: true,
      doneAt: 1,
      dueDate: TODAY,
    })
    // Checked before APP-310 stamped `doneAt`: read, and still left out.
    await task(house, 'Checked long ago', { done: true, dueDate: TODAY })
    await task(packing, 'Sunscreen')
    await task(packing, 'Passports', { assigneeId: aliceId })
    // A linked list has no rows in Convex; this one must never be read.
    await task(linked, 'Stray row', { dueDate: TODAY })
    await task(theirs, 'Their task', { dueDate: TODAY })
    return { aliceId }
  })
  return { t, ...ids }
}

const titles = (answer: { tasks: { title: string }[] }) =>
  answer.tasks.map((task) => task.title).sort()

describe('tasks.smartLists', () => {
  test('open tasks on any smart list, from the named Group only', async () => {
    const { t, aliceId } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.smartLists, { groupSlug: JANSEN, today: TODAY })
    expect(answer.me).toBe(aliceId)
    expect(titles(answer)).toEqual([
      'Alice, someday',
      'Late bins',
      'Nobody, someday',
      'Passports',
      'Plants today',
      'Rent in six days',
    ])
  })

  test('Upcoming stops after seven days', async () => {
    const { t } = await seed()
    const answer = await t
      .withIdentity(alice)
      .query(api.tasks.smartLists, { groupSlug: JANSEN, today: '2026-11-17' })
    expect(titles(answer)).not.toContain('Rent in six days')
  })

  test('another Member sees their own Mine', async () => {
    const { t } = await seed()
    const answer = await t
      .withIdentity(bob)
      .query(api.tasks.smartLists, { groupSlug: DE_VRIES, today: TODAY })
    expect(titles(answer)).toEqual(['Their task'])
  })

  test('refuses a Group the caller is not in, and a malformed day', async () => {
    const { t } = await seed()
    await expect(
      t
        .withIdentity(bob)
        .query(api.tasks.smartLists, { groupSlug: JANSEN, today: TODAY }),
    ).rejects.toThrow('Not a member of that group')
    await expect(
      t
        .withIdentity(alice)
        .query(api.tasks.smartLists, { groupSlug: JANSEN, today: '18-11' }),
    ).rejects.toThrow('Invalid date')
  })
})
