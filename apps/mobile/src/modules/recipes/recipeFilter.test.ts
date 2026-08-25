import { describe, expect, test } from 'vitest'

import { recipeCollection } from './recipeFilter'

const collection = [
  { title: 'Sunday roast', tags: ['sunday', 'beef'] },
  { title: 'Pasta for a crowd', tags: ['quick'] },
  { title: 'Club sourdough', tags: ['bread', 'Slow'] },
]

const titles = (query: string) =>
  recipeCollection(collection, query).map((r) => r.title)

describe('searching a collection', () => {
  test('finds a recipe by part of its name', () => {
    expect(titles('roast')).toEqual(['Sunday roast'])
  })

  test('finds a recipe by one of its tags', () => {
    expect(titles('bread')).toEqual(['Club sourdough'])
  })

  test('does not care about case, in the query or in the recipe', () => {
    expect(titles('SLOW')).toEqual(['Club sourdough'])
    expect(titles('sUnDaY')).toEqual(['Sunday roast'])
  })

  test('a word in two recipes finds both', () => {
    expect(titles('u')).toEqual([
      'Club sourdough',
      'Pasta for a crowd',
      'Sunday roast',
    ])
  })

  test('nothing matching is empty, so the screen has something to say', () => {
    expect(titles('lasagne')).toEqual([])
  })
})

describe('an empty field is not a filter', () => {
  test('no query returns the whole collection', () => {
    expect(titles('')).toHaveLength(3)
  })

  test('spaces alone return the whole collection', () => {
    expect(titles('   ')).toHaveLength(3)
  })

  test('a query is trimmed before it is matched', () => {
    expect(titles('  roast  ')).toEqual(['Sunday roast'])
  })
})

describe('the order is the reader’s, not the database’s', () => {
  test('recipes come back by title', () => {
    expect(titles('')).toEqual([
      'Club sourdough',
      'Pasta for a crowd',
      'Sunday roast',
    ])
  })

  test('the list handed in is not reordered under the caller', () => {
    const original = [...collection]
    recipeCollection(collection, '')
    expect(collection).toEqual(original)
  })
})
