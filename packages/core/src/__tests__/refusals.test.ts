import { describe, expect, test } from 'vitest'
import { AI_LIMIT_KIND, isAiLimitReached } from '../aiLimit'
import {
  ACCOUNT_DELETED,
  calendarRefusal,
  readCalendarRefusal,
  readRefusal,
  refusal,
  refusalKind,
  refusalSentence,
  TASTING_REFUSALS,
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
