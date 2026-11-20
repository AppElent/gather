/**
 * The Loyalty card that is open (APP-443): the card that was on screen when
 * the member last left Gather. The Control Center / Action Button control
 * opens it again instead of the quick-actions sheet, so at the till the card
 * is one press away (`HomeScreenActionLinks`).
 *
 * The card's screen records it while it is focused (`useRecordOpenCard`) and
 * clears it when it loses focus by navigation: back, another tab, Edit.
 * Leaving the app keeps it, and stamps the time it left, so a card put away
 * with the phone still counts. It is stored in the one key-value store
 * (`prefs/localPreference.ts`) so that it survives the app being killed:
 * `open-card-store.ts`. This file is the pure part, the rules.
 *
 * "Open" lasts `OPEN_CARD_MAX_AGE_MS`. "The last card ever opened" was
 * rejected: the sheet would then never be reachable from the control again.
 */

/** How long after the member left Gather a card still counts as open. */
export const OPEN_CARD_MAX_AGE_MS = 30 * 60_000

export interface OpenCard {
  cardId: string
  /** The Group it was open in, by id: the app's name for a Group. */
  groupId: string
  /** That Group's slug, which the saved copy of its cards is keyed by. */
  groupSlug: string
  /** When it was last on screen: opened, or the app left with it up. */
  at: number
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/** The stored record, or null for nothing or anything unreadable. */
export function parseOpenCard(raw: string | null): OpenCard | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { cardId, groupId, groupSlug, at } = value as Record<string, unknown>
    if (!nonEmpty(cardId) || !nonEmpty(groupId) || !nonEmpty(groupSlug))
      return null
    if (typeof at !== 'number' || !Number.isFinite(at)) return null
    return { cardId, groupId, groupSlug, at }
  } catch {
    return null
  }
}

/** Whether a card recorded at `at` still counts as open at `now`. */
export function isFreshOpenCard(card: Pick<OpenCard, 'at'>, now: number) {
  // A clock set back since: not fresh.
  return card.at <= now && now - card.at <= OPEN_CARD_MAX_AGE_MS
}
