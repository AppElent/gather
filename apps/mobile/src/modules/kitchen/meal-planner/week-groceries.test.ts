import { describe, expect, test } from 'vitest'

import { pickRows, type SourceLine } from '../add-to-groceries/pick'
import type { PlannedMeal } from './week'
import {
  defaultDays,
  type WeekRecipe,
  weekGroceryLines,
} from './week-groceries'

const meal = (id: string, date: string, recipeId?: string, title = id): PlannedMeal =>
  ({
    _id: id,
    date,
    slot: 'dinner',
    title,
    recipeId,
    imageUrl: null,
  }) as PlannedMeal

const read = (key: string, name: string, quantity?: number, unit?: 'g' | 'el' | 'blik'): SourceLine => ({
  key,
  text: name,
  read: {
    kind: 'read',
    via: 'local',
    name,
    ...(quantity !== undefined ? { quantity } : {}),
    ...(unit ? { unit } : {}),
  },
  servings: 4,
})

const label = (meals: readonly PlannedMeal[]) => meals.map((m) => `${m.title} ${m.date.slice(8)}`).join(', ')

// A week with four recipes that share ingredients, written for 4.
const recipes = new Map<string, WeekRecipe>([
  ['pesto', { _id: 'pesto', title: 'Pasta pesto', servings: 4 }],
  ['shakshuka', { _id: 'shakshuka', title: 'Shakshuka', servings: 4 }],
  ['tacos', { _id: 'tacos', title: 'Tacos', servings: 4 }],
  ['zalm', { _id: 'zalm', title: 'Zalm uit de oven', servings: 2 }],
])
const lines = new Map<string, SourceLine[]>([
  ['pesto', [read('0', 'Penne', 500, 'g'), read('1', 'Olijfolie', 1, 'el'), read('2', 'Cherrytomaten', 250, 'g')]],
  ['shakshuka', [read('0', 'Eieren', 6), read('1', 'Rode ui', 1), read('2', 'Olijfolie', 2, 'el'), read('3', 'Tomatenblokjes', 2, 'blik')]],
  ['tacos', [read('0', 'Rode uien', 1), read('1', 'Avocado', 2)]],
  ['zalm', [read('0', 'Zalmfilet', 2), read('1', 'Olijfolie', 1, 'el')]],
])
const week = [
  meal('ma', '2026-11-23', 'pesto', 'Pasta pesto'),
  meal('di', '2026-11-24', 'shakshuka', 'Shakshuka'),
  meal('wo', '2026-11-25', undefined, "Tosti's"),
  meal('do', '2026-11-26', 'tacos', 'Tacos'),
  meal('vr', '2026-11-27', 'zalm', 'Zalm uit de oven'),
]

describe('defaultDays', () => {
  test('from today to the end of the week, only days with a meal', () => {
    expect([...defaultDays('2026-11-23', '2026-11-25', week)]).toEqual([
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ])
  })

  test('a week still to come counts from Monday; one that is over counts whole', () => {
    expect(defaultDays('2026-11-23', '2026-11-20', week).size).toBe(5)
    expect(defaultDays('2026-11-23', '2026-12-02', week).size).toBe(5)
  })
})

describe('weekGroceryLines', () => {
  const all = week.map((m) => ({ meal: m, servings: 4 }))

  test('combines what several recipes share, and lists quick meals to check', () => {
    const result = weekGroceryLines({ meals: all, recipes, lines, label })
    const byName = Object.fromEntries(result.lines.map((line) => [line.text, line]))
    // 1 + 2 + 1 el for 2 people cooked for 4 = 5 el.
    expect(byName.Olijfolie.read).toMatchObject({ quantity: 5, unit: 'el' })
    expect(byName.Olijfolie.detail).toBe('Pasta pesto 23, Shakshuka 24, Zalm uit de oven 27')
    // "Rode ui" and "Rode uien" are one item.
    expect(byName['Rode ui'].read).toMatchObject({ quantity: 2 })
    expect(byName['Rode ui'].detail).toBe('Shakshuka 24, Tacos 26')
    expect(result.lines.every((line) => line.topUp)).toBe(true)
    expect(result.lines).toHaveLength(8)
    expect(result.toCheck.map((m) => m.title)).toEqual(["Tosti's"])
  })

  test('scales each meal to its own servings', () => {
    const result = weekGroceryLines({
      meals: [
        { meal: week[1], servings: 6 },
        { meal: week[4], servings: 3 },
      ],
      recipes,
      lines,
      label,
    })
    const byName = Object.fromEntries(result.lines.map((line) => [line.text, line.read]))
    expect(byName.Eieren).toMatchObject({ quantity: 9 })
    // 2 el for 6 of a recipe for 4 is 3; 1 el for 3 of a recipe for 2 is 1,5.
    expect(byName.Olijfolie).toMatchObject({ quantity: 4.5, unit: 'el' })
    expect(byName.Zalmfilet).toMatchObject({ quantity: 3 })
  })

  test('a day that does not count leaves its meal out', () => {
    const result = weekGroceryLines({ meals: all.slice(3), recipes, lines, label })
    expect(result.lines.map((line) => line.text)).toEqual(['Rode uien', 'Avocado', 'Zalmfilet', 'Olijfolie'])
  })

  test('a line still being read stays its own, under its meal', () => {
    const reading = new Map(lines)
    reading.set('tacos', [{ key: '0', text: 'een handje koriander', read: { kind: 'reading' } }])
    const result = weekGroceryLines({ meals: [all[3]], recipes, lines: reading, label })
    expect(result.lines).toEqual([
      {
        key: 'do:0',
        text: 'een handje koriander',
        read: { kind: 'reading' },
        detail: 'Tacos 26',
        topUp: true,
      },
    ])
  })

  test('a row keeps its key while the days change', () => {
    const one = weekGroceryLines({ meals: all, recipes, lines, label })
    const two = weekGroceryLines({ meals: all.slice(1), recipes, lines, label })
    const key = (result: typeof one, name: string) => result.lines.find((line) => line.text === name)?.key
    expect(key(one, 'Olijfolie')).toBe(key(two, 'Olijfolie'))
  })
})

describe('the week on the list', () => {
  const all = week.map((m) => ({ meal: m, servings: 4 }))
  const sheet = (items: Parameters<typeof pickRows>[0]['items']) =>
    pickRows({ lines: weekGroceryLines({ meals: all, recipes, lines, label }).lines, items, ticks: {} })

  test('tops up what is there: 1 red onion on the list becomes 2', () => {
    const { rows, lines: adding } = sheet([{ id: 'a', title: 'Rode uien', quantity: 1, done: false }])
    const onions = rows.find((row) => row.title === 'Rode ui')
    expect(onions).toMatchObject({
      on: true,
      adds: { quantity: 1 },
      meta: { kind: 'merge', from: { quantity: 1 }, to: { quantity: 2 } },
    })
    expect(adding.find((line) => line.title === 'Rode ui')).toEqual({
      title: 'Rode ui',
      quantity: 2,
      topUp: true,
      source: 'Shakshuka 24, Tacos 26',
    })
  })

  test('a second run for the same week adds nothing', () => {
    const first = sheet([])
    expect(first.lines).toHaveLength(8)
    // The list as the first run left it.
    const after = first.lines.map((line, index) => ({
      id: `t${index}`,
      title: line.title,
      ...(line.quantity !== undefined ? { quantity: line.quantity } : {}),
      ...(line.unit !== undefined ? { unit: line.unit } : {}),
      done: false,
    }))
    const second = sheet(after)
    expect(second.lines).toEqual([])
    expect(second.rows.every((row) => !row.on && row.meta?.kind === 'covered')).toBe(true)
  })

  test('a covered row ticked by hand adds its whole amount on top', () => {
    const items = [{ id: 'a', title: 'Avocado', quantity: 2, done: false }]
    const rows = weekGroceryLines({ meals: all, recipes, lines, label }).lines
    const key = rows.find((line) => line.text === 'Avocado')?.key ?? ''
    const { lines: adding } = pickRows({ lines: rows, items, ticks: { [key]: true } })
    expect(adding.find((line) => line.title === 'Avocado')).toEqual({
      title: 'Avocado',
      quantity: 2,
      source: 'Tacos 26',
    })
  })
})
