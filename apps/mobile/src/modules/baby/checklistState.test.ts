import { describe, expect, test } from 'vitest'

import { taskSections, toggledTask } from './checklistState'

describe('task sections', () => {
  test('keeps completed tasks out of the active list', () => {
    expect(
      taskSections([
        { _id: 'one', done: false },
        { _id: 'two', done: true },
        { _id: 'three', done: false },
      ]),
    ).toEqual({
      active: [
        { _id: 'one', done: false },
        { _id: 'three', done: false },
      ],
      completed: [{ _id: 'two', done: true }],
    })
  })
})

describe('optimistic task completion', () => {
  test('returns a new list with only the requested task toggled', () => {
    const tasks = [
      { _id: 'one', done: false },
      { _id: 'two', done: true },
    ]

    expect(toggledTask(tasks, 'one')).toEqual([
      { _id: 'one', done: true },
      { _id: 'two', done: true },
    ])
    expect(toggledTask(tasks, 'one')).not.toBe(tasks)
    expect(tasks).toEqual([
      { _id: 'one', done: false },
      { _id: 'two', done: true },
    ])
  })
})
