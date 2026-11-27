import { describe, expect, test } from 'vitest'

import {
  holdsJobs,
  inAnySmartList,
  inSmartList,
  type SmartListOf,
  upcomingDays,
  upcomingUntil,
} from './smartLists'

const today = '2026-11-18'
const scope = { today, me: 'me' }
const chores: SmartListOf = { kind: 'chores', grocery: false }
const plain: SmartListOf = { kind: 'plain', grocery: false }

describe('smart list rules (APP-301)', () => {
  test('Today is due today or before, open only', () => {
    expect(inSmartList('today', { done: false, dueDate: today }, plain, scope)).toBe(true)
    expect(
      inSmartList('today', { done: false, dueDate: '2026-11-01' }, plain, scope),
    ).toBe(true)
    expect(
      inSmartList('today', { done: false, dueDate: '2026-11-19' }, plain, scope),
    ).toBe(false)
    expect(inSmartList('today', { done: false }, plain, scope)).toBe(false)
    expect(inSmartList('today', { done: true, dueDate: today }, plain, scope)).toBe(false)
  })

  test('Upcoming runs seven days from today, overdue included', () => {
    expect(upcomingUntil(today)).toBe('2026-11-24')
    const due = (dueDate: string) =>
      inSmartList('upcoming', { done: false, dueDate }, plain, scope)
    expect(due('2026-11-10')).toBe(true)
    expect(due('2026-11-24')).toBe(true)
    expect(due('2026-11-25')).toBe(false)
  })

  test('Mine is assigned to the asker; unknown asker owns nothing', () => {
    const mine = { done: false, assigneeId: 'me' }
    expect(inSmartList('mine', mine, plain, scope)).toBe(true)
    expect(inSmartList('mine', { done: false, assigneeId: 'sanne' }, plain, scope)).toBe(false)
    expect(inSmartList('mine', mine, plain, { today, me: null })).toBe(false)
    // Grocery or not, a task given to you is yours.
    expect(
      inSmartList('mine', mine, { kind: 'groceries', grocery: true }, scope),
    ).toBe(true)
  })

  test('Unassigned is nobody’s, on lists of jobs only', () => {
    const free = { done: false }
    expect(inSmartList('unassigned', free, plain, scope)).toBe(true)
    expect(inSmartList('unassigned', free, chores, scope)).toBe(true)
    expect(
      inSmartList('unassigned', { done: false, assigneeId: 'me' }, plain, scope),
    ).toBe(false)
    // Someone in Todoist who is no Member, their name known or not (APP-405).
    expect(
      inSmartList('unassigned', { done: false, assigneeName: '' }, plain, scope),
    ).toBe(false)
    for (const kind of ['packing', 'wishlist', 'groceries'] as const) {
      expect(holdsJobs({ kind, grocery: false })).toBe(false)
    }
    // The Group's grocery list may be a plain list made before kinds.
    expect(holdsJobs({ kind: 'plain', grocery: true })).toBe(false)
  })

  test('the server sends a task on any list, and nothing that is on none', () => {
    expect(
      inAnySmartList({ done: false, assigneeId: 'sanne' }, plain, scope),
    ).toBe(false)
    expect(
      inAnySmartList(
        { done: false, assigneeId: 'sanne', dueDate: '2026-11-20' },
        plain,
        scope,
      ),
    ).toBe(true)
  })
})

describe('Upcoming by day', () => {
  test('overdue first, then each day with tasks, in date then title order', () => {
    const tasks = [
      { title: 'Rent', dueDate: '2026-11-24' },
      { title: 'Bins', dueDate: '2026-11-17' },
      { title: 'Plants', dueDate: today },
      { title: 'Dentist', dueDate: today },
      { title: 'Later', dueDate: '2026-12-01' },
      { title: 'Undated' },
    ]
    expect(
      upcomingDays(tasks, today).map((day) => [
        day.key,
        day.tasks.map((task) => task.title),
      ]),
    ).toEqual([
      ['overdue', ['Bins']],
      [today, ['Dentist', 'Plants']],
      ['2026-11-24', ['Rent']],
    ])
  })

  test('no tasks, no days', () => {
    expect(upcomingDays([], today)).toEqual([])
  })
})
