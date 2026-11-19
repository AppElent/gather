import { describe, expect, test } from 'vitest'

import {
  aisleOf,
  aisleSections,
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
