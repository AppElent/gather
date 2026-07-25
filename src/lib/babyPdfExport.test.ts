import { describe, expect, test } from 'vitest'
import type { Doc } from '../../convex/_generated/dataModel'
import type { BabyEventType } from '../../convex/lib/babyEvents'
import { groupEventsByMinute } from './babyPdfExport'

const START = new Date('2026-07-25T09:00:00').getTime()

function event(
  id: string,
  type: BabyEventType,
  timestamp: number,
): Doc<'babyEvents'> {
  return {
    _id: id as Doc<'babyEvents'>['_id'],
    _creationTime: timestamp,
    babyId: 'baby1' as Doc<'babyEvents'>['babyId'],
    type,
    timestamp,
    loggedBy: 'user1' as Doc<'babyEvents'>['loggedBy'],
    data: {},
  } as Doc<'babyEvents'>
}

describe('groupEventsByMinute', () => {
  test('merges everything logged in the same minute', () => {
    const groups = groupEventsByMinute([
      event('a', 'diaper', START),
      event('b', 'temperature', START),
      event('c', 'feeding', START),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].events.map((e) => e._id)).toEqual(['a', 'b', 'c'])
  })

  test('groups by the clock minute, not the exact millisecond', () => {
    const groups = groupEventsByMinute([
      event('a', 'diaper', START + 1200),
      event('b', 'feeding', START + 45_000),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].minuteMs).toBe(START)
  })

  test('keeps different minutes apart and in time order', () => {
    const groups = groupEventsByMinute([
      event('later', 'feeding', START + 120_000),
      event('earlier', 'diaper', START),
    ])
    expect(groups.map((g) => g.minuteMs)).toEqual([START, START + 120_000])
    expect(groups.map((g) => g.events[0]._id)).toEqual(['earlier', 'later'])
  })

  test('drops types that were not included in the export', () => {
    const groups = groupEventsByMinute(
      [event('a', 'diaper', START), event('b', 'note', START)],
      ['diaper'],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].events.map((e) => e._id)).toEqual(['a'])
  })

  test('returns nothing when no event matches', () => {
    expect(groupEventsByMinute([event('a', 'note', START)], ['sleep'])).toEqual(
      [],
    )
  })
})
