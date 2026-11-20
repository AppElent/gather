import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  daysAgo,
  type GroceryPurchase,
  groceryCadence,
  groceryHabits,
  grocerySuggestions,
  isGroceryHabitDue,
} from './habits'

const T0 = Date.UTC(2026, 10, 1, 10)
const HOUR = 60 * 60 * 1000

/** One purchase of `key` per day offset, at 10:00 UTC. */
function bought(
  key: string,
  days: number[],
  extra: Partial<GroceryPurchase> = {},
): GroceryPurchase[] {
  return days.map((day) => ({
    key,
    title: key,
    at: T0 + day * DAY_MS,
    ...extra,
  }))
}

describe('groceryHabits', () => {
  it('counts purchases and takes the median gap as the usual interval', () => {
    // Milk every 4 days, once after 6: the median keeps it at 4.
    const [milk] = groceryHabits(bought('melk', [0, 4, 8, 14, 18]))
    expect(milk).toMatchObject({
      key: 'melk',
      count: 5,
      intervalDays: 4,
      lastAt: T0 + 18 * DAY_MS,
    })
  })

  it('has no interval below three purchases', () => {
    const [cheese] = groceryHabits(bought('kas', [0, 7]))
    expect(cheese.count).toBe(2)
    expect(cheese.intervalDays).toBeNull()
  })

  it('counts checks on the same trip once', () => {
    const purchases = [
      ...bought('melk', [0, 7, 14]),
      // A second row of milk on the last trip, an hour later.
      { key: 'melk', title: 'melk', at: T0 + 14 * DAY_MS + HOUR },
    ]
    const [milk] = groceryHabits(purchases)
    expect(milk.count).toBe(3)
    expect(milk.intervalDays).toBe(7)
    expect(milk.lastAt).toBe(T0 + 14 * DAY_MS + HOUR)
  })

  it('accepts purchases in any order', () => {
    const [milk] = groceryHabits(bought('melk', [8, 0, 4]))
    expect(milk).toMatchObject({ count: 3, intervalDays: 4 })
  })

  it('reads the median of the newest ten gaps only', () => {
    // Monthly for a year, then weekly for eleven weeks.
    const monthly = Array.from({ length: 12 }, (_, i) => i * 30)
    const weekly = Array.from({ length: 11 }, (_, i) => 360 + (i + 1) * 7)
    const [habit] = groceryHabits(bought('kofie', [...monthly, ...weekly]))
    expect(habit.intervalDays).toBe(7)
  })

  it('keeps the newest title and aisle and the most common amount', () => {
    const purchases: GroceryPurchase[] = [
      { key: 'melk', title: 'melk', at: T0, quantity: 2, unit: 'pak' },
      {
        key: 'melk',
        title: 'Melk',
        at: T0 + 4 * DAY_MS,
        quantity: 2,
        unit: 'pak',
        category: 'dairy',
      },
      { key: 'melk', title: 'Halfvolle melk', at: T0 + 8 * DAY_MS, quantity: 1 },
    ]
    const [milk] = groceryHabits(purchases)
    expect(milk).toMatchObject({
      title: 'Halfvolle melk',
      quantity: 2,
      unit: 'pak',
      category: 'dairy',
    })
  })

  it('takes the newest amount when amounts tie', () => {
    const [milk] = groceryHabits([
      { key: 'melk', title: 'melk', at: T0, quantity: 1 },
      { key: 'melk', title: 'melk', at: T0 + DAY_MS, quantity: 3 },
    ])
    expect(milk.quantity).toBe(3)
  })

  it('sorts the most bought first, then the most recently bought', () => {
    const habits = groceryHabits([
      ...bought('kas', [0, 7]),
      ...bought('melk', [0, 4, 8]),
      ...bought('brod', [1, 8]),
    ])
    expect(habits.map((habit) => habit.key)).toEqual(['melk', 'brod', 'kas'])
  })

  it('skips purchases without a key', () => {
    expect(groceryHabits(bought('', [0, 1, 2]))).toEqual([])
  })
})

describe('the interval rule', () => {
  const [milk] = groceryHabits(bought('melk', [0, 4, 8]))
  const last = T0 + 8 * DAY_MS

  it('is not due before the usual interval has passed', () => {
    expect(isGroceryHabitDue(milk, last + 4 * DAY_MS - 1)).toBe(false)
  })

  it('is due once the usual interval has passed', () => {
    expect(isGroceryHabitDue(milk, last + 4 * DAY_MS)).toBe(true)
    expect(isGroceryHabitDue(milk, last + 12 * DAY_MS)).toBe(true)
  })

  it('stays due for 30 days at least, so a holiday does not drop it', () => {
    expect(isGroceryHabitDue(milk, last + 30 * DAY_MS)).toBe(true)
    expect(isGroceryHabitDue(milk, last + 31 * DAY_MS)).toBe(false)
  })

  it('stops after three usual intervals when that is longer', () => {
    const [paper] = groceryHabits(bought('toiletpapier', [0, 21, 42]))
    const after = T0 + 42 * DAY_MS
    expect(isGroceryHabitDue(paper, after + 63 * DAY_MS)).toBe(true)
    expect(isGroceryHabitDue(paper, after + 64 * DAY_MS)).toBe(false)
  })

  it('never suggests a name bought fewer than three times', () => {
    const [cheese] = groceryHabits(bought('kas', [0, 7]))
    expect(isGroceryHabitDue(cheese, T0 + 100 * DAY_MS)).toBe(false)
  })
})

describe('grocerySuggestions', () => {
  const now = T0 + 30 * DAY_MS
  const habits = groceryHabits([
    ...bought('melk', [10, 14, 18, 22, 26]), // every 4 days, due
    ...bought('brod', [27, 28, 29]), // daily, due
    ...bought('kas', [0, 7, 14]), // weekly, due (16 days)
    ...bought('ei', [16, 23, 29]), // weekly, not due
    ...bought('pindakas', [0, 7]), // twice only
  ])

  it('lists due names, most bought first', () => {
    expect(
      grocerySuggestions(habits, { now, exclude: new Set() }).map((h) => h.key),
    ).toEqual(['melk', 'brod', 'kas'])
  })

  it('leaves out names on the list or hidden', () => {
    expect(
      grocerySuggestions(habits, {
        now,
        exclude: new Set(['melk', 'kas']),
      }).map((h) => h.key),
    ).toEqual(['brod'])
  })

  it('shows at most eight', () => {
    const many = groceryHabits(
      Array.from({ length: 12 }, (_, i) => bought(`item${i}`, [0, 1, 2])).flat(),
    )
    expect(
      grocerySuggestions(many, { now: T0 + 5 * DAY_MS, exclude: new Set() }),
    ).toHaveLength(8)
  })
})

describe('groceryCadence', () => {
  it.each([
    [0.6, { unit: 'day' }],
    [1, { unit: 'day' }],
    [4, { unit: 'days', count: 4 }],
    [5, { unit: 'days', count: 5 }],
    [7, { unit: 'week' }],
    [10, { unit: 'week' }],
    [14, { unit: 'weeks', count: 2 }],
    [21, { unit: 'weeks', count: 3 }],
    [30, { unit: 'month' }],
    [61, { unit: 'months', count: 2 }],
  ])('%s days reads as %o', (days, cadence) => {
    expect(groceryCadence(days)).toEqual(cadence)
  })
})

describe('daysAgo', () => {
  it('counts calendar days', () => {
    const now = new Date(2026, 10, 19, 9).getTime()
    expect(daysAgo(new Date(2026, 10, 19, 1).getTime(), now)).toBe(0)
    expect(daysAgo(new Date(2026, 10, 18, 23).getTime(), now)).toBe(1)
    expect(daysAgo(new Date(2026, 10, 11, 12).getTime(), now)).toBe(8)
  })
})
