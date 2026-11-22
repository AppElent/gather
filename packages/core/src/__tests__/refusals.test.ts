import { describe, expect, test } from 'vitest'
import { AI_LIMIT_KIND, isAiLimitReached } from '../aiLimit'
import {
  ACCOUNT_DELETED,
  calendarRefusal,
  GROUP_REFUSAL_CODES,
  groupRefusal,
  groupRefusalSentence,
  readCalendarRefusal,
  readGroupRefusal,
  readRefusal,
  readTaskRefusal,
  refusal,
  refusalKind,
  refusalSentence,
  TASTING_REFUSALS,
  taskRefusal,
} from '../refusals'

const thrown = (data: unknown) => Object.assign(new Error('wire'), { data })

describe('reading a refusal off a thrown value', () => {
  test('finds the kind in its own vocabulary, and only there', () => {
    const error = thrown(refusal('notYourTasting'))
    expect(readRefusal(error, TASTING_REFUSALS)).toBe('notYourTasting')
    expect(readRefusal(error, ['someOtherRefusal'] as const)).toBeNull()
  })

  test('a calendar code comes back without its wire prefix', () => {
    expect(readCalendarRefusal(thrown(calendarRefusal('conflict')))).toBe(
      'conflict',
    )
    expect(readCalendarRefusal(thrown(calendarRefusal('titleRequired')))).toBe(
      'titleRequired',
    )
    expect(readCalendarRefusal(thrown({ kind: 'conflict' }))).toBeNull()
  })

  test('anything that is not a refusal reads as none', () => {
    for (const error of [
      new Error('calendar:conflict'),
      thrown('calendar:conflict'),
      thrown({ kind: 7 }),
      thrown(null),
      'calendar:conflict',
      null,
    ]) {
      expect(refusalKind(error)).toBeNull()
      expect(readCalendarRefusal(error)).toBeNull()
    }
  })

  test('installed phones can still find a calendar refusal in the message', () => {
    // A ConvexError's message is the JSON of its data, and builds in the field
    // search that message for the wire kind.
    expect(JSON.stringify(calendarRefusal('deleted'))).toContain(
      'calendar:deleted',
    )
    expect(JSON.stringify(refusal('notYourTasting'))).toContain(
      'notYourTasting',
    )
  })

  test('the daily AI cap is one more kind', () => {
    expect(isAiLimitReached(thrown({ kind: AI_LIMIT_KIND }))).toBe(true)
    expect(isAiLimitReached(thrown(refusal('needsName')))).toBe(false)
  })
})

describe('refusalSentence', () => {
  test('is the sentence a server threw, and nothing else', () => {
    expect(refusalSentence(thrown(ACCOUNT_DELETED))).toBe(ACCOUNT_DELETED)
    expect(refusalSentence(thrown({ kind: 'needsName' }))).toBeNull()
    expect(refusalSentence(new Error('Account deleted'))).toBeNull()
  })
})

describe('task refusals (APP-302)', () => {
  test('cross the wire namespaced and read back', () => {
    const error = thrown(taskRefusal('assignee-not-member'))
    expect(refusalKind(error)).toBe('tasks:assignee-not-member')
    expect(readTaskRefusal(error)).toBe('assignee-not-member')
    expect(readTaskRefusal(thrown(calendarRefusal('assignee-not-member')))).toBe(
      null,
    )
  })
})

describe('group refusals (APP-429)', () => {
  test('read in the reader’s words, and only for a Group refusal (APP-580)', () => {
    const sentences = {
      'not-signed-in': 'a',
      'unknown-slug': 'b',
      'not-a-member': 'c',
    } as const
    expect(
      groupRefusalSentence(
        thrown(groupRefusal('unknown-slug', 'No group has that slug')),
        sentences,
      ),
    ).toBe('b')
    expect(groupRefusalSentence(thrown({ kind: 'tasks:not-found' }), sentences)).toBeNull()
    expect(groupRefusalSentence(new Error('Boom'), sentences)).toBeNull()
  })

  test('each code round-trips, namespaced on the wire', () => {
    for (const code of GROUP_REFUSAL_CODES) {
      const data = groupRefusal(code, 'A sentence')
      expect(data.kind).toBe(`groups:${code}`)
      expect(readGroupRefusal(thrown(data))).toBe(code)
    }
    expect(readGroupRefusal(thrown({ kind: 'not-a-member' }))).toBeNull()
    expect(readGroupRefusal(thrown('Not a member of that group'))).toBeNull()
  })

  test('the sentence it carries is still the sentence a reader shows', () => {
    const error = thrown(
      groupRefusal('not-a-member', 'Not a member of that group'),
    )
    expect(refusalSentence(error)).toBe('Not a member of that group')
    expect(refusalSentence(thrown({ kind: 'groups:x', message: 7 }))).toBeNull()
  })
})
