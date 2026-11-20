/**
 * Where the open Loyalty card (`open-card.ts`, APP-443) is kept, and the hook
 * the card's screen records it with.
 */
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import {
  clearPreference,
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../../../prefs/localPreference'
import { type OpenCard, parseOpenCard } from './open-card'

export function readOpenCard(): OpenCard | null {
  return parseOpenCard(readPreference(PREFERENCE_KEYS.openLoyaltyCard))
}

export function recordOpenCard(card: Omit<OpenCard, 'at'>, now = Date.now()) {
  const record: OpenCard = { ...card, at: now }
  writePreference(PREFERENCE_KEYS.openLoyaltyCard, JSON.stringify(record))
}

/**
 * Forget the open card, if it is still this one: leaving one card's screen
 * must not clear another card that was recorded since.
 */
export function clearOpenCard(cardId: string) {
  if (readOpenCard()?.cardId !== cardId) return
  clearPreference(PREFERENCE_KEYS.openLoyaltyCard)
}

/** Forget whichever card is open: at sign-out, with the retained Group. */
export function forgetOpenCard() {
  clearPreference(PREFERENCE_KEYS.openLoyaltyCard)
}

/**
 * The card whose screen is focused in this process, if any: the control then
 * leaves it where it is instead of pushing a second copy. Memory only; after a
 * cold start no card screen is up.
 */
let cardOnScreen: string | null = null

export function isCardOnScreen(cardId: string) {
  return cardOnScreen === cardId
}

/**
 * Records `card` as open while its screen is `focused`, and clears it when
 * focus leaves by navigation or `missing` says the card is gone (deleted, or
 * not in this Group). Not on a missing value while loading: a card screen
 * waiting for Convex is still the card the member opened.
 */
export function useRecordOpenCard(
  card: Omit<OpenCard, 'at'>,
  focused: boolean,
  missing: boolean,
) {
  const { cardId, groupId, groupSlug } = card
  const missingRef = useRef(missing)
  missingRef.current = missing

  useEffect(() => {
    if (!focused) return
    const record = () => {
      if (!missingRef.current) recordOpenCard({ cardId, groupId, groupSlug })
    }
    record()
    cardOnScreen = cardId
    // Leaving the app (or pulling down Control Center) keeps the card, and
    // its time becomes the time the member left.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') record()
    })
    return () => {
      subscription.remove()
      if (cardOnScreen === cardId) cardOnScreen = null
      clearOpenCard(cardId)
    }
  }, [focused, cardId, groupId, groupSlug])

  useEffect(() => {
    if (missing) clearOpenCard(cardId)
  }, [missing, cardId])
}
