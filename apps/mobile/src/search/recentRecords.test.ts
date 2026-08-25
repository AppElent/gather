import { describe, expect, test } from 'vitest'

import { addRecentRecord, recordsForGroup } from './recentRecords'

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
      { ...recipe, openedAt: 20 },
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
