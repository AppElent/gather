import { GROCERY_AISLES } from '@gather/core/groceries'
import { describe, expect, test } from 'vitest'
import { movedTo } from '../../arrange/arrange'
import {
  aisleArrangement,
  aisleCounts,
  aisleOf,
  aisleSections,
  checkedOncePerName,
  groceryListsOf,
  inCheckedSection,
  openGroceryList,
  recentDays,
  recentWeeks,
} from './groceryList'
import {
  committed,
  firstDropIndex,
  headingKey,
  sectionMove,
} from './sectionArrange'

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

  test("splits days at the Group's midnight", () => {
    const rows = [
      { id: 'a', doneAt: Date.parse('2026-11-18T10:30:00Z') },
      { id: 'b', doneAt: Date.parse('2026-11-18T09:30:00Z') },
    ]
    expect(recentDays(rows, 'Pacific/Kiritimati').map((d) => d.date)).toEqual([
      '2026-11-19',
      '2026-11-18',
    ])
  })

  test('reaches back at least a week', () => {
    const now = at('2026-11-18T12:00:00')
    expect(recentWeeks([], now)).toBe(1)
    expect(recentWeeks([{ doneAt: now - 3 * 86_400_000 }], now)).toBe(1)
    expect(recentWeeks([{ doneAt: now - 10 * 86_400_000 }], now)).toBe(2)
  })
})

describe('a list of its own aisle order (APP-313)', () => {
  const tasks = [
    { id: 'cola', category: 'drinks' },
    { id: 'appels', category: 'produce' },
    { id: 'brood', category: 'bakery' },
  ]

  test('sections follow the saved order, and aisles it leaves out follow', () => {
    const sections = aisleSections(tasks, ['drinks', 'bakery'])
    expect(sections.map((s) => s.aisle)).toEqual(['drinks', 'bakery', 'produce'])
  })

  test('two lists with different orders walk the same items differently', () => {
    const market = aisleSections(tasks, ['produce', 'bakery', 'drinks'])
    const ah = aisleSections(tasks, ['drinks', 'produce', 'bakery'])
    expect(market.map((s) => s.aisle)).not.toEqual(ah.map((s) => s.aisle))
  })

  test('counts only what is still to get, per aisle', () => {
    expect(
      aisleCounts([
        { category: 'produce', done: false },
        { category: 'produce', done: false },
        { category: 'produce', done: true },
        { category: 'drinks', done: false },
      ]),
    ).toEqual({ produce: 2, drinks: 1 })
  })
})

describe('which grocery list opens', () => {
  const lists = [
    { _id: 'chores', order: 0, grocery: false, writable: true },
    { _id: 'market', order: 2, grocery: true, writable: true },
    { _id: 'ah', order: 1, grocery: true, writable: true },
  ]

  test('grocery lists only, in list order', () => {
    expect(groceryListsOf(lists).map((l) => l._id)).toEqual(['ah', 'market'])
  })

  test('the last used one, else the first', () => {
    const grocery = groceryListsOf(lists)
    expect(openGroceryList(grocery, 'market')?._id).toBe('market')
    expect(openGroceryList(grocery, null)?._id).toBe('ah')
    // Deleted, or no longer a grocery list: the first one opens instead.
    expect(openGroceryList(grocery, 'chores')?._id).toBe('ah')
    expect(openGroceryList([], 'ah')).toBeUndefined()
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

describe('dragging between aisles (APP-522)', () => {
  const items = [
    { id: 'cola', category: 'drinks' },
    { id: 'appels', category: 'produce' },
    { id: 'mystery' },
    { id: 'peren', category: 'produce' },
  ]

  test('every aisle has a heading, empty ones too, in the list order', () => {
    const order = aisleArrangement(items, ['drinks', 'produce'])
    expect(order.slice(0, 5)).toEqual([
      headingKey('drinks'),
      'cola',
      headingKey('produce'),
      'appels',
      'peren',
    ])
    // Every other aisle follows in the default order, Other with the item
    // that has none; nothing lands above the first heading.
    expect(order.filter((key) => key.startsWith('§'))).toHaveLength(
      GROCERY_AISLES.length,
    )
    expect(order.slice(-2)).toEqual([headingKey('other'), 'mystery'])
    expect(firstDropIndex(order)).toBe(1)
  })

  test('an item dropped under another aisle moves there, and only it', () => {
    const order = aisleArrangement(items, ['drinks', 'produce'])
    // Cola, from Drinks to below Appels in Produce.
    const next = movedTo(order, order.indexOf('cola'), order.indexOf('appels'))
    expect(committed(next).ids).toEqual(['appels', 'cola', 'peren', 'mystery'])
    expect(sectionMove(order, next, 'cola')).toBe('produce')
    expect(sectionMove(order, next, 'appels')).toBeUndefined()
  })

  test('into an empty aisle, and out of Other', () => {
    const order = aisleArrangement(items, null)
    // The default order starts with Produce, then Bakery, which is empty.
    const next = movedTo(
      order,
      order.indexOf('mystery'),
      order.indexOf(headingKey('bakery')) + 1,
    )
    expect(sectionMove(order, next, 'mystery')).toBe('bakery')
  })

  test('rearranging within an aisle changes no aisle', () => {
    const order = aisleArrangement(items, null)
    const next = movedTo(order, order.indexOf('peren'), order.indexOf('appels'))
    expect(committed(next).ids.slice(0, 2)).toEqual(['peren', 'appels'])
    expect(sectionMove(order, next, 'peren')).toBeUndefined()
  })

  test('an aisle changed elsewhere while arranging is not written back', () => {
    // Opened with Cola under Drinks; another phone (or the AI) then moved it
    // to Snacks. Dragging Peren within Produce says nothing about Cola.
    const order = aisleArrangement(items, ['drinks', 'produce'])
    const next = movedTo(order, order.indexOf('peren'), order.indexOf('appels'))
    expect(sectionMove(order, next, 'peren')).toBeUndefined()
    expect(sectionMove(order, next, 'cola')).toBeUndefined()
  })
})
