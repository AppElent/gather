import { describe, expect, test } from 'vitest'
import type { Doc } from '../../convex/_generated/dataModel'
import { summarizeEvent } from './babyEventSummary'
import { en } from './i18n/messages/en'

const START = new Date('2026-07-25T09:00:00').getTime()

function feeding(
  data: Record<string, unknown>,
  endTimestamp?: number,
): Doc<'babyEvents'> {
  return {
    _id: 'event1' as Doc<'babyEvents'>['_id'],
    _creationTime: START,
    babyId: 'baby1' as Doc<'babyEvents'>['babyId'],
    type: 'feeding',
    timestamp: START,
    endTimestamp,
    loggedBy: 'user1' as Doc<'babyEvents'>['loggedBy'],
    data,
  } as Doc<'babyEvents'>
}

describe('summarizeEvent — feeding', () => {
  test('shows both sides with their minutes', () => {
    expect(
      summarizeEvent(
        feeding({ method: 'breast', side: 'both', leftMin: 10, rightMin: 8 }),
        en.baby.log,
      ),
    ).toBe('Breastfeeding · Left 10m · Right 8m')
  })

  test('shows only the side that was fed', () => {
    expect(
      summarizeEvent(
        feeding({ method: 'breast', side: 'right', rightMin: 7 }),
        en.baby.log,
      ),
    ).toBe('Breastfeeding · Right 7m')
  })

  test('falls back to the plain side for entries without minutes', () => {
    expect(
      summarizeEvent(feeding({ method: 'breast', side: 'left' }), en.baby.log),
    ).toBe('Breastfeeding · Left')
  })

  test('bottle feeds still show the amount', () => {
    expect(
      summarizeEvent(feeding({ method: 'bottle', amountMl: 120 }), en.baby.log),
    ).toBe('Bottle · 120 ml')
  })
})
