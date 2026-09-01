import { describe, expect, test } from 'vitest'

import {
  addRecentRecord,
  clearGroupRecords,
  isRecentRecord,
  recordsForGroup,
} from './recentRecords'
import { hrefFor } from './searchResults'

const recipe = {
  id: 'recipe-1',
  type: 'recipe' as const,
  title: 'Comté tart',
  detail: 'dinner',
}

describe('Recent records', () => {
  test('keeps one newest entry per record in each Group', () => {
    const first = addRecentRecord([], 'home', recipe, 10)
    const second = addRecentRecord(first, 'home', recipe, 20)

    expect(recordsForGroup(second, 'home')).toEqual([
      { ...recipe, groupSlug: 'home', openedAt: 20 },
    ])
  })

  test('does not mix Groups and keeps only ten entries', () => {
    let records = addRecentRecord([], 'other', recipe, 1)
    for (let index = 0; index < 11; index++) {
      records = addRecentRecord(
        records,
        'home',
        { ...recipe, id: `recipe-${index}` },
        index,
      )
    }

    expect(recordsForGroup(records, 'other')).toHaveLength(1)
    expect(recordsForGroup(records, 'home')).toHaveLength(10)
    expect(recordsForGroup(records, 'home')[0]?.id).toBe('recipe-10')
  })
})

describe('Reading a stored record back', () => {
  const stored = { ...recipe, groupSlug: 'home', openedAt: 1 }

  test('accepts a record of every type it can open', () => {
    expect(isRecentRecord(stored)).toBe(true)
    expect(isRecentRecord({ ...stored, type: 'note' })).toBe(true)
    expect(isRecentRecord({ ...stored, type: 'calendarEvent' })).toBe(true)
    expect(isRecentRecord({ ...stored, type: 'tasting', kind: 'cheese' })).toBe(
      true,
    )
  })

  test('drops a tasting written before the Kind was stored', () => {
    // What the old code wrote: the *translated* Kind, in `detail`, and nothing
    // routable. There is no address to recover from that, so it goes.
    expect(isRecentRecord({ ...stored, type: 'tasting', detail: 'Kaas' })).toBe(
      false,
    )
    expect(isRecentRecord({ ...stored, type: 'tasting', kind: 'Cheese' })).toBe(
      false,
    )
  })

  test('rejects a record of no known type', () => {
    expect(isRecentRecord({ ...stored, type: 'invoice' })).toBe(false)
    expect(isRecentRecord({ ...stored, openedAt: 'yesterday' })).toBe(false)
    expect(isRecentRecord(null)).toBe(false)
  })
})

describe('Where a record opens', () => {
  test('a tasting routes on its Kind, never on its subtitle', () => {
    expect(
      hrefFor({
        id: 'subject-1',
        type: 'tasting',
        title: 'Comté',
        detail: 'Kaas',
        kind: 'cheese',
      }),
    ).toEqual({
      pathname: '/all/tasting/[kind]/subject',
      params: { kind: 'cheese', subjectId: 'subject-1' },
    })
  })

  test('a tasting with no Kind has no address', () => {
    expect(
      hrefFor({ id: 'subject-1', type: 'tasting', title: 'Comté', detail: '' }),
    ).toBeNull()
  })

  test('every other type routes on its id', () => {
    expect(hrefFor(recipe)).toEqual({
      pathname: '/all/recipes/recipe',
      params: { recipeId: 'recipe-1' },
    })
  })
})

describe('Clearing one Group', () => {
  test('forgets this Group and leaves the others alone', () => {
    let records = addRecentRecord([], 'home', recipe, 1)
    records = addRecentRecord(records, 'other', { ...recipe, id: 'note-1' }, 2)

    const cleared = clearGroupRecords(records, 'home')

    expect(recordsForGroup(cleared, 'home')).toEqual([])
    expect(recordsForGroup(cleared, 'other')).toEqual(
      recordsForGroup(records, 'other'),
    )
  })
})
