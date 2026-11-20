import { describe, expect, it } from 'vitest'
import { groceryCompletions, groceryNameList } from './completions'
import type { GroceryHabit } from './habits'
import { groceryNames } from './index'
import { groceryKey } from './normalise'

const habit = (title: string, count: number): GroceryHabit => ({
  key: groceryKey(title),
  title,
  count,
  intervalDays: count >= 3 ? 4 : null,
  lastAt: 0,
})

const names = groceryNameList({
  dairy: 'melk|karnemelk|halfvolle melk|crème fraîche',
  snacks: 'melkchocolade',
})

const shown = (line: string, habits: GroceryHabit[] = []) =>
  groceryCompletions(line, habits, names).map((c) =>
    c.source === 'history' ? `h:${c.habit.title}` : `d:${c.name.name}`,
  )

describe('groceryCompletions', () => {
  it('puts the Group history before the dictionary', () => {
    expect(shown('mel', [habit('Melkchocolade', 2)])).toEqual([
      'h:Melkchocolade',
      'd:melk',
      'd:halfvolle melk',
    ])
  })

  it('ranks history by match, then by how often it was bought', () => {
    expect(
      shown('mel', [
        habit('Karnemelk', 9),
        habit('Melk', 3),
        habit('Melkchocolade', 5),
      ]),
    ).toEqual(['h:Melkchocolade', 'h:Melk', 'h:Karnemelk'])
  })

  it('does not offer a history name again from the dictionary', () => {
    expect(shown('melk', [habit('Melk', 4)])).toEqual([
      'h:Melk',
      'd:melkchocolade',
      'd:halfvolle melk',
    ])
  })

  it('completes the name and ignores a typed amount', () => {
    expect(shown('2 pak karn')).toEqual(['d:karnemelk'])
  })

  it('matches without accents', () => {
    expect(shown('creme')).toEqual(['d:crème fraîche'])
  })

  it('needs two letters', () => {
    expect(shown('m')).toEqual([])
    expect(shown('')).toEqual([])
  })
})

describe('groceryNames', () => {
  it('bundles readable names, not dictionary stems', () => {
    const cheese = groceryNames().find((name) => name.name === 'kaas')
    expect(cheese).toMatchObject({ aisle: 'cheese_deli' })
    expect(groceryNames().some((name) => name.name === 'kas')).toBe(false)
  })
})
