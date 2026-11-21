import { describe, expect, it } from 'vitest'
import { groceryCompletions, groceryNameList, typedSpan } from './completions'
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

describe('typedSpan', () => {
  it('finds the typed part at the start, at a word, or anywhere', () => {
    expect(typedSpan('Melk', 'me')).toEqual([0, 2])
    expect(typedSpan('Halfvolle melk', '2 pak melk')).toEqual([10, 14])
    expect(typedSpan('Kipdijfilet', 'dij')).toEqual([3, 6])
  })

  it('ignores case and accents, and maps back onto the name as written', () => {
    expect(typedSpan('Crème fraîche', 'creme f')).toEqual([0, 7])
    expect(typedSpan("Pinda's", 'pindas')).toEqual([0, 7])
  })

  it('answers null when the typed part is not in the name', () => {
    expect(typedSpan('Melk', 'kaas')).toBeNull()
    expect(typedSpan('Melk', '2 pak')).toBeNull()
  })
})
