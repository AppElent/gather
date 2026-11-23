import { en } from '@gather/core/messages'
import { describe, expect, test } from 'vitest'
import { createActions, validateNewSearch } from './createActions'

describe('createActions', () => {
  test('follows the pin order and skips Modules with no create flow', () => {
    const actions = createActions(
      ['wines', 'energy', 'meal-planner', 'recipes', 'tasks'],
      en,
    )
    expect(actions.map((a) => [a.module, a.link])).toEqual([
      ['wines', { to: '/wines', search: { new: true } }],
      ['recipes', expect.objectContaining({ to: '/recipes/new' })],
      ['tasks', { to: '/tasks', search: { new: true } }],
    ])
  })

  test('says which Module each tasting action is for', () => {
    const [cheese, beer] = createActions(['cheeses', 'beers'], en)
    expect(cheese?.label).toBe(beer?.label)
    expect([cheese?.moduleLabel, beer?.moduleLabel]).toEqual([
      'Cheeses',
      'Beers',
    ])
  })

  test('uses the default pins when the Member never chose any', () => {
    expect(createActions(undefined, en).length).toBeGreaterThan(0)
  })
})

describe('validateNewSearch', () => {
  test.each([
    [{ new: true }, { new: true }],
    [{ new: 'true' }, { new: true }],
    [{ new: false }, {}],
    [{ new: '1' }, {}],
    [{}, {}],
  ])('%o → %o', (search, expected) => {
    expect(validateNewSearch(search)).toEqual(expected)
  })
})
