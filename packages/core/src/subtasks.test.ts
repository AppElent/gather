import { describe, expect, test } from 'vitest'

import {
  asksAboutSubtasks,
  reorderedSubtasks,
  reorderWithSubtasks,
  subtaskProgress,
  subtasksOf,
  topLevelTasks,
} from './subtasks'

const task = (
  id: string,
  order: number,
  extra: { done?: boolean; parentTaskId?: string } = {},
) => ({ id, order, done: extra.done ?? false, parentTaskId: extra.parentTaskId })

const attic = [
  task('attic', 0),
  task('boxes', 1, { parentTaskId: 'attic', done: true }),
  task('sweep', 2, { parentTaskId: 'attic' }),
  task('bins', 3),
  task('tip', 4, { parentTaskId: 'attic' }),
]

describe('subtaskProgress', () => {
  test('counts each parent’s subtasks and the ones done', () => {
    const progress = subtaskProgress(attic)
    expect(progress.get('attic')).toEqual({ done: 1, total: 3 })
    expect(progress.has('bins')).toBe(false)
  })
})

describe('topLevelTasks', () => {
  test('leaves subtasks out of the list’s rows', () => {
    expect(topLevelTasks(attic).map((t) => t.id)).toEqual(['attic', 'bins'])
  })

  test('keeps a subtask whose parent is not on the list', () => {
    const orphan = [task('lost', 0, { parentTaskId: 'gone' })]
    expect(topLevelTasks(orphan).map((t) => t.id)).toEqual(['lost'])
  })
})

describe('subtasksOf', () => {
  test('a parent’s subtasks, in order', () => {
    expect(subtasksOf(attic, 'attic').map((t) => t.id)).toEqual([
      'boxes',
      'sweep',
      'tip',
    ])
  })
})

describe('asksAboutSubtasks', () => {
  test('asks when an open task has open subtasks', () => {
    expect(asksAboutSubtasks({ done: false }, { done: 1, total: 3 })).toBe(true)
  })

  test('does not ask when every subtask is done, or there are none', () => {
    expect(asksAboutSubtasks({ done: false }, { done: 3, total: 3 })).toBe(false)
    expect(asksAboutSubtasks({ done: false }, undefined)).toBe(false)
  })

  test('does not ask when unchecking, or for a repeating task', () => {
    expect(asksAboutSubtasks({ done: true }, { done: 0, total: 2 })).toBe(false)
    expect(
      asksAboutSubtasks({ done: false, repeat: {} }, { done: 0, total: 2 }),
    ).toBe(false)
  })
})

describe('reorderWithSubtasks', () => {
  test('puts each parent’s open subtasks right behind it, in its section', () => {
    expect(
      reorderWithSubtasks(['bins', 'attic'], ['kitchen', null], attic, false),
    ).toEqual({
      ids: ['bins', 'attic', 'sweep', 'tip'],
      sectionIds: ['kitchen', null, null, null],
    })
  })

  test('takes checked subtasks along when asked', () => {
    expect(
      reorderWithSubtasks(['attic', 'bins'], undefined, attic, true).ids,
    ).toEqual(['attic', 'boxes', 'sweep', 'tip', 'bins'])
  })

  test('keeps the open steps of a checked parent at the end', () => {
    const tasks = [
      task('done', 0, { done: true }),
      task('step', 1, { parentTaskId: 'done' }),
      task('open', 2),
    ]
    expect(reorderWithSubtasks(['open'], undefined, tasks, false).ids).toEqual([
      'open',
      'step',
    ])
  })
})

describe('reorderedSubtasks', () => {
  const siblings = subtasksOf(attic, 'attic')

  test('hands the same order values out in the new order', () => {
    expect(reorderedSubtasks(siblings, ['tip', 'boxes', 'sweep'])).toEqual([
      { id: 'tip', order: 1 },
      { id: 'boxes', order: 2 },
      { id: 'sweep', order: 4 },
    ])
  })

  test('refuses a set that is not exactly the subtasks', () => {
    expect(reorderedSubtasks(siblings, ['tip', 'boxes'])).toBeNull()
    expect(reorderedSubtasks(siblings, ['tip', 'tip', 'boxes'])).toBeNull()
    expect(reorderedSubtasks(siblings, ['tip', 'boxes', 'bins'])).toBeNull()
  })

  test('spreads subtasks that share an order value', () => {
    const tied = [task('a', 5), task('b', 5)]
    expect(reorderedSubtasks(tied, ['b', 'a'])).toEqual([
      { id: 'b', order: 5 },
      { id: 'a', order: 6 },
    ])
  })
})
