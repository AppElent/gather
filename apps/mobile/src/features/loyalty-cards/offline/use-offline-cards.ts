/**
 * What the auth gate's offline fallback draws for the current availability
 * mode (APP-143).
 *
 * While Gather is unavailable: the copy, read afresh for the account Clerk
 * restored, so the account check of `offlineCards` always applies. While Try
 * again sends the gate back to the splash: the cards last shown, for the same
 * account only, so a barcode open at the till stays on screen. Any other mode
 * draws none.
 */
import { useMemo, useState } from 'react'

import type { AvailabilityMode } from '../../../availability/state'
import { type OfflineCard, offlineCards } from './offline-cards'

const NONE: OfflineCard[] = []

export function useOfflineCards(
  mode: AvailabilityMode,
  account: string | null | undefined,
): { cards: OfflineCard[]; retrying: boolean } {
  const unavailable = mode === 'unavailable'
  const cards = useMemo(
    () => (unavailable ? offlineCards(account) : NONE),
    [unavailable, account],
  )
  const [shown, setShown] = useState({ cards: NONE, account })
  if (unavailable && (shown.cards !== cards || shown.account !== account))
    setShown({ cards, account })
  if (!unavailable && mode !== 'splash' && shown.cards !== NONE)
    setShown({ cards: NONE, account })

  if (unavailable) return { cards, retrying: false }
  if (mode === 'splash' && shown.account === account && shown.cards.length > 0)
    return { cards: shown.cards, retrying: true }
  return { cards: NONE, retrying: false }
}
