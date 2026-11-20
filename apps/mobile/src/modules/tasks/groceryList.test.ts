import { describe, expect, test } from 'vitest'

import {
  aisleOf,
  aisleSections,
  checkedOncePerName,
  inCheckedSection,
  recentDays,
  recentWeeks,
} from './groceryList'

describe('aisle sections', () => {
  test('in the default walking order, empty aisles left out, order kept', () => {
    const sections = aisleSections([
      { id: 'cola', category: 'drinks' },
      { id: 'appels', category: 'produce' },
      { id: 'melk', category: 'dairy' },
      { id: 'peren', category: 'produce' },
    ])
    expect(sections.map((s) => [s.aisle, s.tasks.map((t) => t.id)])).toEqual([
      ['produce', ['appels', 'peren']],
      ['dairy', ['melk']],
      ['drinks', ['cola']],
    ])
  })

  test('an item without a known aisle is under Other, last', () => {
    expect(aisleOf({})).toBe('other')
    expect(aisleOf({ category: 'gone' })).toBe('other')
    const sections = aisleSections([
      { id: 'x' },
      { id: 'brood', category: 'bakery' },
    ])
    expect(sections.map((s) => s.aisle)).toEqual(['bakery', 'other'])
  })
})

describe('the Checked section', () => {
  test('holds what was checked after the last clear', () => {
    expect(inCheckedSection({ done: false }, null)).toBe(false)
    expect(inCheckedSection({ done: true }, null)).toBe(true)
    expect(inCheckedSection({ done: true, doneAt: 200 }, 100)).toBe(true)
    expect(inCheckedSection({ done: true, doneAt: 50 }, 100)).toBe(false)
    // Checked before stamps existed: cleared by any clear.
    expect(inCheckedSection({ done: true }, 100)).toBe(false)
  })
})

describe('Recent in days', () => {
  const at = (iso: string) => new Date(iso).getTime()

  test('one heading per local day, newest first', () => {
    const days = recentDays([
      { id: 'a', doneAt: at('2026-11-18T18:00:00') },
      { id: 'b', doneAt: at('2026-11-18T09:00:00') },
      { id: 'c', doneAt: at('2026-11-14T10:00:00') },
    ])
    expect(days.map((d) => [d.date, d.rows.map((r) => r.id)])).toEqual([
      ['2026-11-18', ['a', 'b']],
      ['2026-11-14', ['c']],
    ])
  })

  test('reaches back at least a week', () => {
    const now = at('2026-11-18T12:00:00')
    expect(recentWeeks([], now)).toBe(1)
    expect(recentWeeks([{ doneAt: now - 3 * 86_400_000 }], now)).toBe(1)
    expect(recentWeeks([{ doneAt: now - 10 * 86_400_000 }], now)).toBe(2)
  })
})

describe('the Checked section', () => {
  test('one row per name, the newest, and none whose name is open', () => {
    const tasks = [
      { id: 'melk-open', title: '2 pak melk', done: false },
      { id: 'melk-checked', title: 'Melk', done: true, doneAt: 5 },
      { id: 'brood-old', title: 'brood', done: true, doneAt: 1 },
      { id: 'kaas', title: 'kaas', done: true, doneAt: 3 },
      { id: 'brood-new', title: 'Brood', done: true, doneAt: 4 },
    ]
    const checked = tasks.filter((task) => task.done)
    expect(checkedOncePerName(tasks, checked).map((task) => task.id)).toEqual([
      'kaas',
      'brood-new',
    ])
  })
})
