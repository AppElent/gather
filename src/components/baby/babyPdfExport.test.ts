import type { BabyEventType } from '@gather/core/domain'
import { en } from '@gather/core/messages'
import { describe, expect, test, vi } from 'vitest'
import type { Doc } from '../../../convex/_generated/dataModel'

const saved = vi.hoisted(() => ({ files: [] as string[] }))

vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    setTextColor() {}
    text() {}
    addPage() {}
    save(name: string) {
      saved.files.push(name)
    }
  },
}))
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

import { exportBabyLogPdf, groupEventsByMinute } from './babyPdfExport'

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

describe('exportBabyLogPdf', () => {
  test("stamps the filename with the Group's day when a zone is given", () => {
    saved.files.length = 0
    // 22:30Z on 24 Nov: 25 Nov in Tokyo, 24 Nov in Amsterdam.
    const to = Date.parse('2026-11-24T22:30:00Z')
    const base = {
      baby: { name: 'Sanne', birthDate: '2026-01-01' },
      messages: en.baby.log,
      eventTypes: en.baby.eventTypes,
      locale: 'en',
      events: [],
      from: Date.parse('2026-01-01T00:00:00Z'),
      to,
    }
    exportBabyLogPdf({ ...base, timeZone: 'Asia/Tokyo' })
    exportBabyLogPdf({ ...base, timeZone: 'Europe/Amsterdam' })
    expect(saved.files).toEqual([
      'sanne-log-2026-11-25.pdf',
      'sanne-log-2026-11-24.pdf',
    ])
  })
})
