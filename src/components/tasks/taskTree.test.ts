import { describe, expect, test } from 'vitest'
import { toTaskTree } from './taskTree'

/**
 * The order a card draws a list in.
 *
 * The queries hand back a flat set with each task naming its parent, because
 * that is what a database can check. Everything about *reading* it as an
 * outline — parents before their children, open before finished, a row knowing
 * whether it can move — happens here.
 */

const task = (
  _id: string,
  over: { done?: boolean; order?: number; parentTaskId?: string } = {},
) => ({ _id, done: false, order: 0, ...over })

const shape = (rows: ReturnType<typeof toTaskTree>) =>
  rows.map((r) => [r.task._id, r.depth])

describe('toTaskTree', () => {
  test('puts each parent before its own children', () => {
    const rows = toTaskTree([
      task('child-b', { parentTaskId: 'parent', order: 1 }),
      task('parent', { order: 0 }),
      task('child-a', { parentTaskId: 'parent', order: 0 }),
      task('other', { order: 1 }),
    ])

    expect(shape(rows)).toEqual([
      ['parent', 0],
      ['child-a', 1],
      ['child-b', 1],
      ['other', 0],
    ])
  })

  test('nests as deep as the data does', () => {
    const rows = toTaskTree([
      task('a'),
      task('b', { parentTaskId: 'a' }),
      task('c', { parentTaskId: 'b' }),
      task('d', { parentTaskId: 'c' }),
    ])

    expect(shape(rows)).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 3],
    ])
  })

  test('finished tasks sink below their open siblings, at their own level', () => {
    const rows = toTaskTree([
      task('parent'),
      task('done-child', { parentTaskId: 'parent', done: true, order: 0 }),
      task('open-child', { parentTaskId: 'parent', order: 1 }),
    ])

    expect(shape(rows)).toEqual([
      ['parent', 0],
      ['open-child', 1],
      ['done-child', 1],
    ])
  })

  test('a task whose parent is not here is drawn, at the top level', () => {
    // Happens while a refresh is mid-flight. A row drawn a level too high is
    // better than a row that vanishes because of a reference, and it settles
    // itself.
    const rows = toTaskTree([task('orphan', { parentTaskId: 'gone' })])
    expect(shape(rows)).toEqual([['orphan', 0]])
  })

  test('says which rows have somewhere to move to', () => {
    const rows = toTaskTree([
      task('a', { order: 0 }),
      task('b', { order: 1 }),
      task('child', { parentTaskId: 'a' }),
    ])

    // `child` is an only child, so it has no sibling either side — even though
    // rows sit above and below it on screen. Moving it past one of those would
    // move it past its own parent.
    const child = rows.find((r) => r.task._id === 'child')
    expect(child).toMatchObject({
      hasPreviousSibling: false,
      hasNextSibling: false,
    })
    expect(rows[0]).toMatchObject({
      hasPreviousSibling: false,
      hasNextSibling: true,
    })
  })

  test('an empty list is an empty outline', () => {
    expect(toTaskTree([])).toEqual([])
  })
})
