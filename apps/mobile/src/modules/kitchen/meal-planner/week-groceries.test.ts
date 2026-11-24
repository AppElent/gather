import { todayIn } from '@gather/core/civil-date'
import { editedRead, pickRows, type SourceLine, settleLine, withEdits } from '@gather/core/grocery-pick'
import { describe, expect, test } from 'vitest'
import type { PlannedMeal } from './week'
import {
  defaultDays,
  rowsOfLines,
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

describe("defaultDays with the Group's today (APP-475)", () => {
  test('two zones either side of midnight count from different days', () => {
    // 23:30 Tuesday in Amsterdam is already Wednesday in Tokyo.
    const now = new Date('2026-11-24T22:30:00Z')
    const first = (zone: string) =>
      [...defaultDays('2026-11-23', todayIn(zone, now), week)][0]
    expect(first('Europe/Amsterdam')).toBe('2026-11-24')
    expect(first('Asia/Tokyo')).toBe('2026-11-25')
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

describe('a line being read when the person ticks it (APP-423)', () => {
  const tacos = (koriander: SourceLine, touched?: ReadonlySet<string>) => {
    const lines2 = new Map(lines)
    lines2.set('tacos', [read('0', 'Rode uien', 1), koriander])
    lines2.set('shakshuka', [read('0', 'Koriander', 1)])
    return weekGroceryLines({
      meals: [
        { meal: week[1], servings: 4 },
        { meal: week[3], servings: 4 },
      ],
      recipes,
      lines: lines2,
      label,
      ...(touched ? { touched } : {}),
    }).lines
  }
  const reading: SourceLine = { key: '1', text: 'een handje koriander', read: { kind: 'reading' } }
  const answered: SourceLine = read('1', 'Koriander', 1)

  test('the answer merges the line into an item and the row remembers its key', () => {
    const before = tacos(reading).find((l) => l.text === 'een handje koriander')
    expect(before?.key).toBe('do:1')
    const after = tacos(answered).find((l) => l.text === 'Koriander')
    expect(after?.was).toEqual(['di:0', 'do:1'])
    expect(after?.detail).toBe('Shakshuka 24, Tacos 26')
  })

  test('an untick made while it was read is still unticked when the answer arrives', () => {
    const ticks = { 'do:1': false }
    const while_ = pickRows({ lines: tacos(reading), items: [], ticks })
    expect(while_.rows.find((r) => r.key === 'do:1')?.on).toBe(false)
    const after = pickRows({ lines: tacos(answered), items: [], ticks })
    expect(after.rows.find((r) => r.title === 'Koriander')?.on).toBe(false)
    expect(after.lines.map((l) => l.title)).not.toContain('Koriander')
  })

  test('a tick on the row of a covered item survives too', () => {
    const items = [{ id: 'a', title: 'Koriander', quantity: 5, done: false }]
    const ticks = { 'do:1': true }
    const after = pickRows({ lines: tacos(answered), items, ticks })
    expect(after.rows.find((r) => r.title === 'Koriander')?.on).toBe(true)
  })

  test('a retype made while it was read is on the row when the answer arrives', () => {
    const edits = { 'do:1': editedRead('2 bosjes koriander') }
    const shown = withEdits(tacos(answered), edits)
    const { rows, lines: adding } = pickRows({ lines: shown, items: [], ticks: { 'do:1': true } })
    expect(rows.find((r) => r.title === 'Koriander')).toMatchObject({ amount: { quantity: 2, unit: 'bos' }, on: true })
    expect(adding.find((l) => l.title === 'Koriander')).toMatchObject({ quantity: 2, unit: 'bos' })
  })

  test('an untick on a reading row takes only its own meal’s amount, not the other meals’ (APP-479)', () => {
    const touched = new Set(['do:1'])
    const ticks = { 'do:1': false }
    const rows = tacos(answered, touched)
    // Shakshuka’s Koriander stays its own item row; Tacos’ is a row of its own.
    expect(rows.filter((l) => l.text === 'Koriander').map((l) => [l.key, l.detail])).toEqual([
      ['item:koriander:count', 'Shakshuka 24'],
      ['item:koriander:do:1', 'Tacos 26'],
    ])
    const { rows: shown, lines: adding } = pickRows({ lines: rows, items: [], ticks })
    expect(shown.filter((r) => r.title === 'Koriander').map((r) => r.on)).toEqual([true, false])
    expect(adding.filter((l) => l.title === 'Koriander')).toEqual([
      { title: 'Koriander', quantity: 1, topUp: true, source: 'Shakshuka 24' },
    ])
    // Untouched, the answer still joins the item, as before.
    expect(tacos(answered).filter((l) => l.text === 'Koriander')).toHaveLength(1)
  })

  test('a retype on a reading row replaces only its own meal’s amount (APP-479)', () => {
    const touched = new Set(['do:1'])
    const rows = tacos(answered, touched)
    const shown = withEdits(rows, { 'do:1': editedRead('2 bosjes koriander') })
    const { rows: picked, lines: adding } = pickRows({
      lines: shown,
      items: [],
      ticks: { 'do:1': true },
    })
    const koriander = picked.filter((r) => r.title === 'Koriander')
    expect(koriander.map((r) => r.amount)).toEqual([{ quantity: 1 }, { quantity: 2, unit: 'bos' }])
    expect(adding.filter((l) => l.title === 'Koriander')).toHaveLength(2)
  })

  test('a tick on a reading row that turns out covered tops up instead of adding it all (APP-479)', () => {
    const items = [{ id: 'a', title: 'Koriander', quantity: 5, done: false }]
    const rows = tacos(answered, new Set(['do:1']))
    const { rows: picked, lines: adding } = pickRows({ lines: rows, items, ticks: { 'do:1': true } })
    expect(picked.find((r) => r.key === 'item:koriander:do:1')).toMatchObject({
      on: true,
      meta: { kind: 'covered' },
    })
    expect(adding).toEqual(expect.not.arrayContaining([expect.objectContaining({ title: 'Koriander' })]))
  })

  test('a row keeps its key when another line of that item is read or kept apart (APP-590)', () => {
    // Two Koriander lines whose units do not add up: two rows of one item.
    const keys = (shakshuka: SourceLine, touched: ReadonlySet<string> = new Set()) => {
      const lines2 = new Map(lines)
      lines2.set('shakshuka', [shakshuka])
      lines2.set('tacos', [read('0', 'Koriander', 10, 'g')])
      return weekGroceryLines({
        meals: [
          { meal: week[1], servings: 4 },
          { meal: week[3], servings: 4 },
        ],
        recipes,
        lines: lines2,
        label,
        touched,
      })
        .lines.filter((l) => l.text === 'Koriander')
        .map((l) => [l.key, l.detail])
    }
    const reading: SourceLine = { key: '0', text: 'wat koriander', read: { kind: 'reading' } }
    const answered = read('0', 'Koriander', 1)
    // Shakshuka's line is still being read: Tacos' row is the only one.
    expect(keys(reading)).toEqual([['item:koriander:mass', 'Tacos 26']])
    // Read and joined, ahead of Tacos: Tacos' row keeps its key.
    expect(keys(answered)).toEqual([
      ['item:koriander:count', 'Shakshuka 24'],
      ['item:koriander:mass', 'Tacos 26'],
    ])
    // Read after the person touched it: it stays apart, Tacos' key holds too.
    expect(keys(answered, new Set(['di:0']))).toEqual([
      ['item:koriander:mass', 'Tacos 26'],
      ['item:koriander:di:0', 'Shakshuka 24'],
    ])
  })

  describe('a row whose lines change keeps what was done to it (APP-590)', () => {
    const olie = (
      days: number[],
      own: Record<string, SourceLine>,
      formerRows: Map<string, Set<string>>,
    ) => {
      const lines2 = new Map(lines)
      for (const [recipe, line] of Object.entries(own)) lines2.set(recipe, [line])
      const shown = weekGroceryLines({
        meals: days.map((day) => ({ meal: week[day], servings: 4 })),
        recipes,
        lines: lines2,
        label,
        formerRows,
      }).lines
      rowsOfLines(shown, formerRows)
      return shown.filter((l) => l.text === 'Olijfolie')
    }
    const plain: SourceLine = {
      key: '0',
      text: 'olijfolie',
      read: { kind: 'read', via: 'local', name: 'Olijfolie' },
    }

    test('a line without an amount left alone keeps its row’s untick', () => {
      const formerRows = new Map<string, Set<string>>()
      const own = { pesto: read('0', 'Olijfolie', 2, 'el'), shakshuka: plain }
      expect(olie([0, 1], own, formerRows).map((l) => l.key)).toEqual(['item:olijfoli:el'])
      // Unticked, then Monday leaves: Tuesday's row is still off.
      const ticks = { 'item:olijfoli:el': false }
      const left = olie([1], own, formerRows)
      expect(left.map((l) => l.key)).toEqual(['item:olijfoli:count'])
      const { rows } = pickRows({ lines: left, items: [], ticks })
      expect(rows.find((r) => r.title === 'Olijfolie')?.on).toBe(false)
    })

    test('an untick on a row that leaves does not pass to another row of its name', () => {
      const formerRows = new Map<string, Set<string>>()
      // Monday in el, Tuesday in ml, Thursday without an amount (joins el).
      const own = {
        pesto: read('0', 'Olijfolie', 2, 'el'),
        shakshuka: { ...read('0', 'Olijfolie', 100), read: { kind: 'read', via: 'local', name: 'Olijfolie', quantity: 100, unit: 'ml' } } as SourceLine,
        tacos: plain,
      }
      expect(olie([0, 1, 3], own, formerRows).map((l) => l.key)).toEqual([
        'item:olijfoli:el',
        'item:olijfoli:volume',
      ])
      const ticks = { 'item:olijfoli:volume': false }
      const left = olie([0, 3], own, formerRows)
      const { rows } = pickRows({ lines: left, items: [], ticks })
      expect(rows.filter((r) => r.title === 'Olijfolie').map((r) => [r.key, r.on])).toEqual([
        ['item:olijfoli:el', true],
      ])
    })

    test('the latest tick holds when a former row returns', () => {
      const formerRows = new Map<string, Set<string>>()
      const own = { pesto: read('0', 'Olijfolie', 2, 'el'), shakshuka: plain }
      olie([0, 1], own, formerRows)
      // Untick the el row; Monday leaves; tick Tuesday's row back on.
      let ticks: Record<string, boolean> = { 'item:olijfoli:el': false }
      const left = olie([1], own, formerRows)
      ticks = settleLine(ticks, left[0], true)
      // Monday returns: the row is on, as last left.
      const back = olie([0, 1], own, formerRows)
      const { rows } = pickRows({ lines: back, items: [], ticks })
      expect(rows.filter((r) => r.title === 'Olijfolie').map((r) => [r.key, r.on])).toEqual([
        ['item:olijfoli:el', true],
      ])
    })

    test('a row that is still shown keeps its state to itself after a day leaves and returns', () => {
      const formerRows = new Map<string, Set<string>>()
      const own = {
        pesto: read('0', 'Olijfolie', 2, 'el'),
        shakshuka: { ...read('0', 'Olijfolie', 100), read: { kind: 'read', via: 'local', name: 'Olijfolie', quantity: 100, unit: 'ml' } } as SourceLine,
        tacos: plain,
      }
      olie([0, 1, 3], own, formerRows)
      // Monday leaves: Thursday's line joins Tuesday's ml row; then it returns.
      olie([1, 3], own, formerRows)
      const back = olie([0, 1, 3], own, formerRows)
      const { rows } = pickRows({ lines: back, items: [], ticks: { 'item:olijfoli:volume': false } })
      expect(rows.filter((r) => r.title === 'Olijfolie').map((r) => [r.key, r.on])).toEqual([
        ['item:olijfoli:el', true],
        ['item:olijfoli:volume', false],
      ])
    })
  })
})
