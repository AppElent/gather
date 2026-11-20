/**
 * The Control Center control's request for the quick-actions sheet (APP-207).
 *
 * The control's intent (`targets/widgets/_shared/OpenQuickActionsIntent.swift`)
 * runs inside the app and leaves the time it was asked under
 * `CONTROL_REQUEST_KEY` in the app's user defaults, which React Native reads
 * and watches as `Settings` (iOS only). `HomeScreenActionLinks` takes it
 * once, marks it taken, and, if it is still fresh, opens the Loyalty card that is
 * open (APP-443) or else the sheet (`controlTarget`).
 */
import {
  isFreshOpenCard,
  type OpenCard,
} from '../features/loyalty-cards/card/open-card'

/** Must match `OpenQuickActionsIntent.requestKey`. */
export const CONTROL_REQUEST_KEY = 'GatherQuickActionsControlRequestedAt'

/**
 * What a taken request is overwritten with. Not `null`: React Native's
 * `Settings.set` does not remove a key it is given `null` for (seen on the
 * iOS 27 simulator, APP-443), so a "cleared" request stayed in user defaults
 * and a cold launch within the freshness limit took it a second time. Zero is
 * a time that is never fresh.
 */
export const CONTROL_REQUEST_TAKEN = 0

/**
 * How old a request may be and still open the sheet. Long enough for a cold
 * start of a release build, short enough that one the app never took (it was
 * killed while loading) does not open the sheet on some later launch.
 */
export const CONTROL_REQUEST_MAX_AGE_MS = 60_000

/** Whether `requestedAt`, as stored by the intent, still asks for the sheet. */
export function isFreshControlRequest(requestedAt: unknown, now: number) {
  return (
    typeof requestedAt === 'number' &&
    Number.isFinite(requestedAt) &&
    now - requestedAt <= CONTROL_REQUEST_MAX_AGE_MS &&
    // A clock set back since: not fresh.
    requestedAt <= now
  )
}

/**
 * What the control opens (APP-443): the Loyalty card that is open, when there
 * is one, else the quick-actions sheet. The card counts when it is fresh
 * (`isFreshOpenCard`), in the Group the app is in, and not missing from that
 * Group's saved copy of its cards. With no saved copy the card opens anyway:
 * its screen waits for Convex, as when it is opened from the list. A card
 * whose screen is already up stays as it is (`stay`): no second copy.
 */
export function controlTarget(
  card: OpenCard | null,
  {
    now,
    currentGroupId,
    savedCardIds,
    isOnScreen,
  }: {
    now: number
    /** The Group the app is in (the retained one), or null. */
    currentGroupId: string | null
    /** The ids in the card's Group's saved copy, or undefined without one. */
    savedCardIds: readonly string[] | undefined
    /** Whether this card's screen is focused right now. */
    isOnScreen: (cardId: string) => boolean
  },
): { kind: 'card'; cardId: string } | { kind: 'stay' } | { kind: 'sheet' } {
  if (
    !card ||
    !isFreshOpenCard(card, now) ||
    card.groupId !== currentGroupId ||
    (savedCardIds !== undefined && !savedCardIds.includes(card.cardId))
  )
    return { kind: 'sheet' }
  if (isOnScreen(card.cardId)) return { kind: 'stay' }
  return { kind: 'card', cardId: card.cardId }
}
