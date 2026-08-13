import { describe, expect, test } from 'vitest'
import { testConvex } from '../../test/convexHarness'
import type { Id } from '../_generated/dataModel'
import { reconcileList } from './taskCache'
import type { UnifiedTask } from './taskProviders/types'

/**
 * Writing a provider's answer into the cache.
 *
 * The provider owns these records (ADR-0013), so this is not a merge and there
 * is nothing local to protect: what the provider returned is what the cache
 * says afterwards, including about the rows it did not mention.
 */

function task(externalId: string, over: Partial<UnifiedTask> = {}): UnifiedTask {
  return { externalId, title: externalId, done: false, ...over }
}

async function listWithCache(tasks: UnifiedTask[]) {
  const t = testConvex()
  const listId = await t.run(async (ctx) => {
    const groupId = await ctx.db.insert('groups', {
      name: 'Jansen',
      slug: 'jansen',
      isPersonal: false,
      inviteCode: 'j',
    })
    return await ctx.db.insert('taskLists', {
      groupId,
      name: 'Linked',
      provider: 'todoist',
      order: 0,
    })
  })
  await t.run((ctx) => reconcileList(ctx, listId, tasks))
  return { t, listId }
}

async function cached(
  t: ReturnType<typeof testConvex>,
  listId: Id<'taskLists'>,
) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query('tasks')
        .withIndex('by_list', (q) => q.eq('listId', listId))
        .collect()
    ).sort((a, b) => a.order - b.order),
  )
}

describe('reconcileList', () => {
  test('writes the provider’s tasks down, in the provider’s order', async () => {
    const { t, listId } = await listWithCache([
      task('a', { title: 'Water plants', priority: 1, labels: ['home'] }),
      task('b', { title: 'Call the plumber', dueDate: '2026-08-12' }),
    ])

    const rows = await cached(t, listId)
    expect(rows.map((r) => [r.externalId, r.title, r.order])).toEqual([
      ['a', 'Water plants', 0],
      ['b', 'Call the plumber', 1],
    ])
    // The row is marked as the provider's, which is what tells it apart from
    // anything written here.
    expect(rows[0].createdBy).toBeUndefined()
  })

  test('takes the provider’s version of a task that changed', async () => {
    const { t, listId } = await listWithCache([task('a', { title: 'Old' })])

    const result = await t.run((ctx) =>
      reconcileList(ctx, listId, [
        task('a', { title: 'New', done: true, priority: 2 }),
      ]),
    )

    expect(result).toEqual({ added: 0, updated: 1, deleted: 0 })
    expect(await cached(t, listId)).toEqual([
      expect.objectContaining({ title: 'New', done: true, priority: 2 }),
    ])
  })

  test('a task the provider no longer has stops existing here', async () => {
    const { t, listId } = await listWithCache([task('a'), task('b')])

    const result = await t.run((ctx) =>
      reconcileList(ctx, listId, [task('a')]),
    )

    expect(result).toEqual({ added: 0, updated: 0, deleted: 1 })
    expect((await cached(t, listId)).map((r) => r.externalId)).toEqual(['a'])
  })

  test('a row with no provider identity cannot survive on an external list', async () => {
    const { t, listId } = await listWithCache([task('a')])
    // Nothing writes one of these — a local write on an external list is
    // refused — so its existence would mean the provider-first rule had been
    // got round, and it must not be allowed to look like data.
    await t.run(async (ctx) => {
      await ctx.db.insert('tasks', {
        listId,
        title: 'Snuck in',
        done: false,
        order: 99,
      })
    })

    await t.run((ctx) => reconcileList(ctx, listId, [task('a')]))

    expect((await cached(t, listId)).map((r) => r.title)).toEqual(['a'])
  })

  test('reconciling the same answer twice writes nothing the second time', async () => {
    const tasks = [task('a', { labels: ['home'] }), task('b')]
    const { t, listId } = await listWithCache(tasks)

    // Idempotence is what makes Refresh cheap enough to offer freely: an
    // unchanged answer must not wake every reader of the list.
    expect(await t.run((ctx) => reconcileList(ctx, listId, tasks))).toEqual({
      added: 0,
      updated: 0,
      deleted: 0,
    })
  })

  test('a provider that answers with nothing empties the cache', async () => {
    const { t, listId } = await listWithCache([task('a'), task('b')])

    await t.run((ctx) => reconcileList(ctx, listId, []))

    expect(await cached(t, listId)).toEqual([])
  })
})

describe('reconciling a hierarchy', () => {
  test('resolves the provider’s parents onto rows in this table', async () => {
    const { t, listId } = await listWithCache([
      task('parent'),
      task('child', { parentExternalId: 'parent' }),
    ])

    const rows = await cached(t, listId)
    const parent = rows.find((r) => r.externalId === 'parent')
    const child = rows.find((r) => r.externalId === 'child')
    // The provider states the shape; the cache holds it as a reference this
    // database can check.
    expect(child?.parentTaskId).toBe(parent?._id)
    expect(parent?.parentTaskId).toBeUndefined()
  })

  test('a subtask that arrives before its parent still finds it', async () => {
    // Nothing promises the provider lists a parent first, and a reference to a
    // row that does not exist yet is not a reference — hence the second pass.
    const { t, listId } = await listWithCache([
      task('child', { parentExternalId: 'parent' }),
      task('parent'),
    ])

    const rows = await cached(t, listId)
    expect(rows.find((r) => r.externalId === 'child')?.parentTaskId).toBe(
      rows.find((r) => r.externalId === 'parent')?._id,
    )
  })

  test('a task moved out of its parent at the provider is moved out here', async () => {
    const { t, listId } = await listWithCache([
      task('parent'),
      task('child', { parentExternalId: 'parent' }),
    ])

    await t.run((ctx) =>
      reconcileList(ctx, listId, [task('parent'), task('child')]),
    )

    expect(
      (await cached(t, listId)).find((r) => r.externalId === 'child')
        ?.parentTaskId,
    ).toBeUndefined()
  })

  test('deleting a parent at the provider takes its subtasks with it', async () => {
    const { t, listId } = await listWithCache([
      task('parent'),
      task('child', { parentExternalId: 'parent' }),
    ])

    // Todoist removes the subtasks with the parent, so its next answer
    // mentions neither — and the cache must not keep a row that is unreachable
    // here and gone there.
    await t.run((ctx) => reconcileList(ctx, listId, []))

    expect(await cached(t, listId)).toEqual([])
  })

  test('parent identity survives a refresh that rewrites every field', async () => {
    const { t, listId } = await listWithCache([
      task('parent'),
      task('child', { parentExternalId: 'parent' }),
    ])
    const before = await cached(t, listId)

    await t.run((ctx) =>
      reconcileList(ctx, listId, [
        task('parent', { title: 'Renamed', done: true }),
        task('child', { parentExternalId: 'parent', title: 'Also renamed' }),
      ]),
    )

    const after = await cached(t, listId)
    // Same rows, not replacements: the provider's ids are what identify them.
    expect(after.map((r) => r._id).sort()).toEqual(
      before.map((r) => r._id).sort(),
    )
    expect(after.find((r) => r.externalId === 'child')?.parentTaskId).toBe(
      after.find((r) => r.externalId === 'parent')?._id,
    )
  })
})
