import { describe, expect, it } from 'vitest'

import { OPEN_CARD_MAX_AGE_MS } from '../features/loyalty-cards/card/open-card'
import {
  CONTROL_REQUEST_MAX_AGE_MS,
  CONTROL_REQUEST_TAKEN,
  controlTarget,
  isFreshControlRequest,
} from './controlRequest'

describe('isFreshControlRequest', () => {
  const now = 1_800_000_000_000

  it('takes a request made just now or within the limit', () => {
    expect(isFreshControlRequest(now, now)).toBe(true)
    expect(isFreshControlRequest(now - CONTROL_REQUEST_MAX_AGE_MS, now)).toBe(
      true,
    )
  })

  it('ignores a request older than the limit', () => {
    expect(
      isFreshControlRequest(now - CONTROL_REQUEST_MAX_AGE_MS - 1, now),
    ).toBe(false)
  })

  it('never takes a request marked as taken', () => {
    expect(isFreshControlRequest(CONTROL_REQUEST_TAKEN, now)).toBe(false)
  })

  it('ignores a request from the future', () => {
    expect(isFreshControlRequest(now + 1, now)).toBe(false)
  })

  it('ignores anything that is not a time', () => {
    for (const value of [null, undefined, '1', Number.NaN, Infinity, {}]) {
      expect(isFreshControlRequest(value, now)).toBe(false)
    }
  })
})

describe('controlTarget', () => {
  const now = 1_800_000_000_000
  const card = { cardId: 'c1', groupId: 'g1', groupSlug: 'home', at: now - 60_000 }
  const here = {
    now,
    currentGroupId: 'g1',
    savedCardIds: ['c0', 'c1'],
    isOnScreen: () => false,
  }

  it('opens the open card when it is fresh, in this Group, and saved', () => {
    expect(controlTarget(card, here)).toEqual({ kind: 'card', cardId: 'c1' })
  })

  it('opens the card when there is no saved copy to check it against', () => {
    expect(controlTarget(card, { ...here, savedCardIds: undefined })).toEqual({
      kind: 'card',
      cardId: 'c1',
    })
  })

  it('leaves the card as it is when its screen is already up', () => {
    expect(
      controlTarget(card, { ...here, isOnScreen: (id) => id === 'c1' }),
    ).toEqual({ kind: 'stay' })
  })

  it('leaves a card on screen as it is however long it has been up', () => {
    const old = { ...card, at: now - OPEN_CARD_MAX_AGE_MS - 1 }
    expect(
      controlTarget(old, { ...here, isOnScreen: (id) => id === 'c1' }),
    ).toEqual({ kind: 'stay' })
  })

  it('opens the sheet when no card is open', () => {
    expect(controlTarget(null, here)).toEqual({ kind: 'sheet' })
  })

  it('opens the sheet when the card was left more than 30 minutes ago', () => {
    const stale = { ...card, at: now - OPEN_CARD_MAX_AGE_MS - 1 }
    expect(controlTarget(stale, here)).toEqual({ kind: 'sheet' })
  })

  it('opens the sheet when the app is in another Group, or none', () => {
    expect(controlTarget(card, { ...here, currentGroupId: 'g2' })).toEqual({
      kind: 'sheet',
    })
    expect(controlTarget(card, { ...here, currentGroupId: null })).toEqual({
      kind: 'sheet',
    })
  })

  it('opens the sheet when the saved copy no longer has the card', () => {
    expect(controlTarget(card, { ...here, savedCardIds: ['c0'] })).toEqual({
      kind: 'sheet',
    })
  })
})
