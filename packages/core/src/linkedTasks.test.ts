import { describe, expect, test } from 'vitest'
import { applyLinkedWrite, type LinkedRow, possibleParents } from './linkedTasks'

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
  test('deleting removes everything under the task', () => {
    expect(
      applyLinkedWrite(rows, { kind: 'delete', taskId: 'a' }, []).map(
        (r) => r.externalId,
      ),
    ).toEqual(['b'])
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
