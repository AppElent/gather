import { describe, expect, it } from 'vitest'

import {
  isFreshOpenCard,
  OPEN_CARD_MAX_AGE_MS,
  parseOpenCard,
} from './open-card'

describe('isFreshOpenCard', () => {
  const now = 1_800_000_000_000

  it('counts a card left up to 30 minutes ago as open', () => {
    expect(OPEN_CARD_MAX_AGE_MS).toBe(30 * 60_000)
    expect(isFreshOpenCard({ at: now }, now)).toBe(true)
    expect(isFreshOpenCard({ at: now - OPEN_CARD_MAX_AGE_MS }, now)).toBe(true)
  })

  it('no longer counts it after that', () => {
    expect(isFreshOpenCard({ at: now - OPEN_CARD_MAX_AGE_MS - 1 }, now)).toBe(
      false,
    )
  })

  it('does not count a time from the future (a clock set back since)', () => {
    expect(isFreshOpenCard({ at: now + 1 }, now)).toBe(false)
  })
})

describe('parseOpenCard', () => {
  const card = { cardId: 'c1', groupId: 'g1', groupSlug: 'home', at: 5 }

  it('reads back what was recorded', () => {
    expect(parseOpenCard(JSON.stringify(card))).toEqual(card)
  })

  it('reads nothing, or anything damaged, as no open card', () => {
    for (const raw of [
      null,
      '',
      'not json',
      'null',
      '42',
      JSON.stringify({ ...card, cardId: '' }),
      JSON.stringify({ ...card, groupId: 7 }),
      JSON.stringify({ ...card, groupSlug: undefined }),
      JSON.stringify({ ...card, at: '5' }),
    ]) {
      expect(parseOpenCard(raw)).toBeNull()
    }
  })
})
