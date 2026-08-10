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
