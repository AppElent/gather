import { beforeEach, describe, expect, test, vi } from 'vitest'

import { originTabFor } from './searchOrigin'

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
})
