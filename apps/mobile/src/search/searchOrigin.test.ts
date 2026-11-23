import { beforeEach, describe, expect, test, vi } from 'vitest'

import { originTabFor, searchModuleFor } from './searchOrigin'

describe('Reading a tab out of a pathname', () => {
  test('takes the first segment, however deep the page', () => {
    expect(originTabFor('/all/recipes/abc')).toBe('all')
    expect(originTabFor('/home')).toBe('home')
    expect(originTabFor('/settings/appearance')).toBe('settings')
  })

  test('refuses Search itself, so entering search cannot erase the origin', () => {
    expect(originTabFor('/search')).toBeNull()
  })

  test('refuses anything that is not a tab', () => {
    expect(originTabFor('/')).toBeNull()
    expect(originTabFor('/nonsense')).toBeNull()
    // `in` walks the prototype chain; `Object.hasOwn` is why this is not 'add'.
    expect(originTabFor('/constructor')).toBeNull()
  })
})

describe('Reading a search Module out of a pathname (APP-660)', () => {
  test('a Module search covers, on its index or deeper', () => {
    expect(searchModuleFor('/all/loyalty-cards')).toBe('loyalty-cards')
    expect(searchModuleFor('/all/loyalty-cards/card')).toBe('loyalty-cards')
    expect(searchModuleFor('/all/tasks')).toBe('tasks')
    expect(searchModuleFor('/all/notes/abc')).toBe('notes')
    expect(searchModuleFor('/all/recipes/recipe')).toBe('recipes')
    expect(searchModuleFor('/all/calendar/evt123')).toBe('calendar')
  })

  test('a tasting page answers its Kind', () => {
    expect(searchModuleFor('/all/tasting/cheese')).toBe('cheeses')
    expect(searchModuleFor('/all/tasting/wine/subject')).toBe('wines')
    expect(searchModuleFor('/all/tasting/beer/compose')).toBe('beers')
    expect(searchModuleFor('/all/tasting')).toBeNull()
    expect(searchModuleFor('/all/tasting/whisky')).toBeNull()
  })

  test('nothing for Home, Settings, the All grid or Search itself', () => {
    expect(searchModuleFor('/home')).toBeNull()
    expect(searchModuleFor('/settings/appearance')).toBeNull()
    expect(searchModuleFor('/all')).toBeNull()
    expect(searchModuleFor('/all/search')).toBeNull()
    expect(searchModuleFor('/search')).toBeNull()
    expect(searchModuleFor('/search/loyalty-cards/card')).toBeNull()
  })

  test('nothing for a Module search does not cover', () => {
    expect(searchModuleFor('/all/groceries')).toBeNull()
    expect(searchModuleFor('/all/energy')).toBeNull()
    expect(searchModuleFor('/all/meal-planner')).toBeNull()
  })

  test('only a Module under All counts', () => {
    expect(searchModuleFor('/settings/loyalty-cards')).toBeNull()
  })
})

describe('Remembering it', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  test('answers home before anything has been visited', async () => {
    const { searchOrigin } = await import('./searchOrigin')
    expect(searchOrigin()).toBe('home')
  })

  test('keeps the last real tab and ignores Search', async () => {
    const { rememberSearchOrigin, searchOrigin } = await import(
      './searchOrigin'
    )

    rememberSearchOrigin('/all/recipes/abc')
    expect(searchOrigin()).toBe('all')

    rememberSearchOrigin('/search')
    expect(searchOrigin()).toBe('all')
  })

  test('each page outside Search is a new arrival carrying its Module', async () => {
    const { rememberSearchOrigin, searchArrival } = await import(
      './searchOrigin'
    )
    expect(searchArrival()).toEqual({ visit: 0, module: null })

    rememberSearchOrigin('/all/loyalty-cards')
    const first = searchArrival()
    expect(first.module).toBe('loyalty-cards')

    rememberSearchOrigin('/all/loyalty-cards/card')
    expect(searchArrival().module).toBe('loyalty-cards')
    expect(searchArrival().visit).toBeGreaterThan(first.visit)

    rememberSearchOrigin('/home')
    expect(searchArrival().module).toBeNull()
  })

  test('Search itself is not an arrival, so a tap while on it changes nothing', async () => {
    const { rememberSearchOrigin, searchArrival } = await import(
      './searchOrigin'
    )
    rememberSearchOrigin('/all/tasting/wine')
    const before = searchArrival()

    rememberSearchOrigin('/search')
    rememberSearchOrigin('/search/notes/abc')
    expect(searchArrival()).toEqual(before)
  })
})
