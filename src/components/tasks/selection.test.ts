import { describe, expect, test } from 'vitest'
import {
  listLink,
  placeLink,
  type TaskPlace,
  taskLink,
  validateTaskSearch,
} from './selection'

const TASK = { id: 't1', listId: 'l1' }
const LIST: TaskPlace = { kind: 'list', listId: 'l1' }

describe('the open task in the address', () => {
  test('only a task id that is a word is kept', () => {
    expect(validateTaskSearch({ task: 't1', other: 1 })).toEqual({ task: 't1' })
    expect(validateTaskSearch({ task: '' })).toEqual({})
    expect(validateTaskSearch({ task: 3 })).toEqual({})
  })

  test('on a desktop a task opens in the panel of the page it is on', () => {
    expect(taskLink(LIST, TASK, true)).toMatchObject({
      to: '/tasks/$listId',
      params: { listId: 'l1' },
      search: { task: 't1' },
    })
    expect(
      taskLink({ kind: 'smart', smartList: 'mine' }, TASK, true),
    ).toMatchObject({
      to: '/tasks/smart/$smartList',
      params: { smartList: 'mine' },
      search: { task: 't1' },
    })
  })

  test('the index has no panel, so its tasks open on their own list', () => {
    expect(taskLink({ kind: 'index' }, TASK, true)).toMatchObject({
      to: '/tasks/$listId',
      search: { task: 't1' },
    })
  })

  test('below the desktop width, and from a task, it is a page', () => {
    const page = { to: '/tasks/task/$taskId', params: { taskId: 't1' } }
    expect(taskLink(LIST, TASK, false)).toMatchObject(page)
    expect(taskLink({ kind: 'task' }, TASK, true)).toMatchObject(page)
  })

  test('a grocery item and a grocery list open in Groceries', () => {
    const item = { ...TASK, grocery: true }
    expect(taskLink(LIST, item, true)).toMatchObject({
      to: '/groceries',
      search: { list: 'l1', item: 't1' },
    })
    expect(listLink({ id: 'l1', grocery: true })).toMatchObject({
      to: '/groceries',
      search: { list: 'l1' },
    })
    expect(listLink({ id: 'l1', grocery: false })).toMatchObject({
      to: '/tasks/$listId',
    })
  })

  test('closing goes to the page itself, with nothing open', () => {
    expect(placeLink(LIST).search).toBeUndefined()
    expect(placeLink({ kind: 'task' })).toMatchObject({ to: '/tasks' })
  })
})
