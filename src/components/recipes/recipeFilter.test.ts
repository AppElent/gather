import { describe, expect, test } from 'vitest'
import { filterRecipes, recipeTags } from './recipeFilter'

const collection = [
  { title: 'Stamppot', tags: ['winter', 'Dutch'] },
  { title: 'Pea soup', tags: ['winter', 'soup'] },
  { title: 'Gazpacho', tags: ['soup', 'summer'] },
  { title: 'Pancakes', tags: [] },
]

const titles = (query: string, tag = '') =>
  filterRecipes(collection, { query, tag }).map((r) => r.title)

describe('recipeTags', () => {
  test('lists each tag in the collection once, alphabetically', () => {
    expect(recipeTags(collection)).toEqual([
      'Dutch',
      'soup',
      'summer',
      'winter',
    ])
  })

  test('offers a tag spelled in two cases once, as first met', () => {
    expect(
      recipeTags([
        { title: 'A', tags: ['Soup'] },
        { title: 'B', tags: ['soup', 'SOUP'] },
      ]),
    ).toEqual(['Soup'])
  })

  test('is empty for a collection without tags', () => {
    expect(recipeTags([{ title: 'Pancakes', tags: [] }])).toEqual([])
  })
})

describe('filterRecipes', () => {
  test('a blank search and no tag keep everything, in order', () => {
    expect(titles('')).toEqual(['Stamppot', 'Pea soup', 'Gazpacho', 'Pancakes'])
    expect(titles('   ')).toEqual(titles(''))
  })

  test('the search matches the title case-insensitively', () => {
    expect(titles('SOUP')).toEqual(['Pea soup'])
    expect(titles('  pan ')).toEqual(['Pancakes'])
  })

  test('the search reads the title only, not the tags', () => {
    expect(titles('winter')).toEqual([])
  })

  test('a tag keeps the recipes carrying it', () => {
    expect(titles('', 'soup')).toEqual(['Pea soup', 'Gazpacho'])
  })

  test('a tag matches its other spellings', () => {
    expect(
      filterRecipes(
        [
          { title: 'A', tags: ['Soup'] },
          { title: 'B', tags: ['soup'] },
          { title: 'C', tags: [] },
        ],
        { query: '', tag: 'Soup' },
      ).map((r) => r.title),
    ).toEqual(['A', 'B'])
  })

  test('search and tag both have to match', () => {
    expect(titles('pa', 'soup')).toEqual(['Gazpacho'])
    expect(titles('stamp', 'soup')).toEqual([])
  })
})
