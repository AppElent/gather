import { describe, expect, test } from 'vitest'
import {
  applyLinkedWrite,
  type LinkedRow,
  moveTargets,
  possibleParents,
} from './linkedTasks'

const row = (
  externalId: string,
  parentExternalId?: string,
  done = false,
): LinkedRow => ({
  externalId,
  done,
  ...(parentExternalId ? { parentExternalId } : {}),
})
const rows = [row('a'), row('a1', 'a'), row('a2', 'a1'), row('b')]
const done = (list: readonly LinkedRow[]) =>
  list.filter((r) => r.done).map((r) => r.externalId)

describe('applyLinkedWrite', () => {
  test('a created task joins the end, once', () => {
    const next = applyLinkedWrite(rows, { kind: 'create' }, [row('c', 'b')])
    expect(next.map((r) => r.externalId)).toEqual(['a', 'a1', 'a2', 'b', 'c'])
    expect(applyLinkedWrite(next, { kind: 'create' }, [row('c', 'b')])).toEqual(
      next,
    )
  })
  test('an update and a move take the answered row in place', () => {
    const next = applyLinkedWrite(rows, { kind: 'move', taskId: 'b' }, [
      row('b', 'a'),
    ])
    expect(next[3].parentExternalId).toBe('a')
  })
  test('completing takes everything under the task with it', () => {
    expect(
      done(applyLinkedWrite(rows, { kind: 'setDone', taskId: 'a', done: true }, [])),
    ).toEqual(['a', 'a1', 'a2'])
  })
  test('a recurring task answered open stays open', () => {
    expect(
      done(
        applyLinkedWrite(rows, { kind: 'setDone', taskId: 'a', done: true }, [
          row('a'),
        ]),
      ),
    ).toEqual([])
  })
  test('reopening a subtask reopens what is above it only', () => {
    const closed = rows.map((r) => ({ ...r, done: true }))
    expect(
      done(
        applyLinkedWrite(closed, { kind: 'setDone', taskId: 'a1', done: false }, []),
      ),
    ).toEqual(['a2', 'b'])
  })
})

test('a task that moved to another list takes everything under it', () => {
  const write = { kind: 'moveToList', taskId: 'a' } as const
  expect(
    applyLinkedWrite(rows, write, [row('a')]).map((r) => r.externalId),
  ).toEqual(['b'])
  expect(
    applyLinkedWrite(rows, { ...write, taskId: 'a1' }, []).map(
      (r) => r.externalId,
    ),
  ).toEqual(['a', 'b'])
})

describe('moveTargets (APP-821)', () => {
  const list = (
    _id: string,
    provider: string,
    connectionId: string | null = null,
    write = provider === 'todoist',
  ) => ({
    _id,
    provider,
    order: 0,
    writable: provider === 'local',
    capabilities: { write },
    connectionId,
  })
  const errands = list('errands', 'todoist', 'c1')
  const lists = [
    errands,
    list('garden', 'todoist', 'c1'),
    list('work', 'todoist', 'c2'),
    list('stuck', 'todoist', 'c1', false),
    list('recipes', 'notion', 'c3'),
    list('home', 'local'),
    list('chores', 'local'),
  ]
  const ids = (from: (typeof lists)[number]) =>
    moveTargets(from, lists).own.map((each) => each._id)

  test('a linked task: writable lists of its own connection', () => {
    expect(ids(errands)).toEqual(['errands', 'garden'])
    expect(moveTargets(errands, lists).other).toHaveLength(5)
  })
  test('a local task: local lists, never a linked one', () => {
    expect(ids(lists[5])).toEqual(['home', 'chores'])
  })
  test('a Notion task, or a server that names no connection: its own list', () => {
    expect(ids(lists[4])).toEqual(['recipes'])
    const unnamed = list('old', 'todoist')
    expect(
      moveTargets(unnamed, [unnamed, list('old2', 'todoist')]).own,
    ).toEqual([unnamed])
  })
})

describe('possibleParents', () => {
  test('open top-level tasks other than itself', () => {
    expect(possibleParents(rows, 'b').map((r) => r.externalId)).toEqual(['a'])
    expect(possibleParents([...rows, row('d', undefined, true)], 'b')).toHaveLength(1)
  })
  test('none for a task with subtasks, or a done one', () => {
    expect(possibleParents(rows, 'a')).toEqual([])
    expect(possibleParents([row('x', undefined, true), row('y')], 'x')).toEqual([])
  })
})
