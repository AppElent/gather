import { TASTING_KINDS } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'

import { isNativeModule, moduleDestination } from '../moduleDestination'
import {
  moduleIdOf,
  TASTING_BASES,
  tabOf,
  tastingHref,
  tastingKindFromRoute,
} from './paths'

/**
 * The addresses, and the one guard on them.
 *
 * Three Modules share one implementation behind a `[kind]` segment, which buys
 * six route files instead of eighteen and costs exactly one thing: the segment
 * has to be checked. This is that check, and the reason it is worth a test is
 * that the failure is silent — a bad segment that fell back to a default would
 * show somebody another Module's contents and look completely normal.
 */

describe('the Kind a route names', () => {
  test('every shipped Kind is a route segment', () => {
    for (const kind of TASTING_KINDS) {
      expect(tastingKindFromRoute(kind)).toBe(kind)
    }
  })

  test('anything else is not a Kind, so the screen redirects', () => {
    expect(tastingKindFromRoute('cheeses')).toBeUndefined()
    expect(tastingKindFromRoute('spirits')).toBeUndefined()
    expect(tastingKindFromRoute('')).toBeUndefined()
    expect(tastingKindFromRoute(undefined)).toBeUndefined()
  })
})

describe('where a screen sends you', () => {
  test('an index is the bare Kind under the tab it is mounted in', () => {
    expect(tastingHref(TASTING_BASES.home, 'wine', '')).toBe(
      '/home/tasting/wine',
    )
    expect(tastingHref(TASTING_BASES.all, 'beer', '')).toBe('/all/tasting/beer')
  })

  test('params ride as an object, because a path cannot carry them', () => {
    expect(
      tastingHref(TASTING_BASES.home, 'cheese', '/subject', { subjectId: 'x' }),
    ).toEqual({
      pathname: '/home/tasting/cheese/subject',
      params: { subjectId: 'x' },
    })
  })

  test('a base knows which tab it belongs to', () => {
    expect(tabOf(TASTING_BASES.home)).toBe('home')
    expect(tabOf(TASTING_BASES.all)).toBe('all')
  })
})

describe('opening a tasting Module from Home or All', () => {
  test('lands on the Kind segment, not on the Module id', () => {
    // The one place a Module's route is not named after it — `cheeses` the
    // Module is `cheese` the Kind in the path.
    expect(moduleDestination('home', 'cheeses')).toBe('/home/tasting/cheese')
    expect(moduleDestination('all', 'wines')).toBe('/all/tasting/wine')
    expect(moduleDestination('all', 'beers')).toBe('/all/tasting/beer')
  })

  test('every tasting Module is declared native, or it would show a placeholder', () => {
    for (const kind of TASTING_KINDS) {
      expect(isNativeModule(moduleIdOf(kind)), moduleIdOf(kind)).toBe(true)
    }
  })

  test('a Module with no native screens still goes to the placeholder', () => {
    expect(moduleDestination('home', 'groceries')).toEqual({
      pathname: '/home/[moduleId]',
      params: { moduleId: 'groceries' },
    })
  })
})
