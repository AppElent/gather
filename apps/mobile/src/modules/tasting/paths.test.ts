import { TASTING_KINDS } from '@gather/core/tastings'
import { describe, expect, test } from 'vitest'

import { tastingKindFromRoute } from './paths'

/**
 * The one guard on the tasting addresses.
 *
 * Three Modules share one implementation behind a `[kind]` segment, which buys
 * three route files instead of nine and costs exactly one thing: the segment
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
