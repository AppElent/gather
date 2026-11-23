import { beforeEach, describe, expect, test, vi } from 'vitest'

import { initialFilters, withModule } from './searchFilters'
import { filtersOnArrival, originTabFor, searchModuleFor } from './searchOrigin'

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

    rememberSearchOrigin('/all/recipes/abc', 'home')
    expect(searchOrigin()).toBe('all')

    rememberSearchOrigin('/search', 'home')
    expect(searchOrigin()).toBe('all')
  })

  test('remembers the Module of the last page outside Search, per Group', async () => {
    const { rememberSearchOrigin, searchOriginModule } = await import(
      './searchOrigin'
    )
    expect(searchOriginModule('home')).toBeNull()

    rememberSearchOrigin('/all/loyalty-cards/card', 'home')
    expect(searchOriginModule('home')).toBe('loyalty-cards')

    rememberSearchOrigin('/search', 'home')
    rememberSearchOrigin('/search/notes/abc', 'home')
    expect(searchOriginModule('home')).toBe('loyalty-cards')

    rememberSearchOrigin('/home', 'home')
    expect(searchOriginModule('home')).toBeNull()
  })

  test('a Module remembered in another Group answers All', async () => {
    const { rememberSearchOrigin, searchOriginModule } = await import(
      './searchOrigin'
    )
    rememberSearchOrigin('/all/tasting/wine', 'old-group')
    expect(searchOriginModule('old-group')).toBe('wines')
    // Removed from the Group while on Search: Search remounts in the fallback.
    expect(searchOriginModule('new-group')).toBeNull()
  })
})

describe('The filters after a tap on the Search tab (APP-660)', () => {
  const typed = { ...initialFilters('tasks'), status: 'done' as const, who: 'sam' }

  test('coming from another Module selects it and keeps the rest', () => {
    expect(filtersOnArrival(typed, 'tasks', 'loyalty-cards')).toEqual({
      module: 'loyalty-cards',
      who: 'sam',
      when: null,
      status: null,
    })
  })

  test('coming from Home after a Module goes back to All Modules', () => {
    expect(filtersOnArrival(typed, 'tasks', null).module).toBeNull()
  })

  test('a Module chosen by hand survives a round trip to the same Module', () => {
    // Opened from Tasks, then Notes chosen by hand.
    const chosen = withModule(initialFilters('tasks'), 'notes')
    expect(filtersOnArrival(chosen, 'tasks', 'tasks')).toBe(chosen)
  })

  test('a chip cleared by hand stays cleared on a tap while on Search', () => {
    const cleared = withModule(initialFilters('wines'), null)
    expect(filtersOnArrival(cleared, 'wines', 'wines')).toBe(cleared)
  })
})
