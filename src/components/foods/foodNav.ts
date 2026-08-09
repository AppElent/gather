import type { AppLink } from '../../lib/appLink'
import { groupLink } from '../../lib/groupPaths'

/**
 * Everywhere the Foods pages can send you.
 *
 * Foods are the Catalog — owned by nobody, readable by everybody (CONTEXT.md) —
 * so which Group is in the URL changes nothing about *what* these pages show.
 * It still has to be carried, because leaving it out would silently drop
 * whoever followed the link out of the Group they were browsing.
 */
/**
 * What is already known about the food somebody is about to add.
 *
 * All three parts are optional and independent: a scan knows the barcode, a
 * search that found nothing knows the words that were typed, and either can
 * have been reached from somewhere that wants the person back afterwards.
 *
 * `returnTo` is deliberately the *day and meal*, not a URL: the only place that
 * sends anyone here expecting them back is the add sheet, which is addressable
 * by exactly those two (#66). Keeping it as data rather than as a serialised
 * link is what stops an arbitrary destination riding in on a query string.
 */
export interface NewFoodIntent {
  barcode?: string
  /** Prefills the name — the term a search matched nothing for (#79). */
  name?: string
  returnTo?: { date: string; meal: string }
}

export interface FoodNav {
  list: AppLink
  /** Adding a food, optionally prefilled and optionally with a way back. */
  create: (intent?: NewFoodIntent) => AppLink
  detail: (foodId: string) => AppLink
  edit: (foodId: string) => AppLink
}

export function groupFoodNav(groupSlug: string): FoodNav {
  return {
    list: groupLink('foods', groupSlug),
    create: (intent) => ({
      ...groupLink('newFood', groupSlug),
      search: {
        barcode: intent?.barcode,
        name: intent?.name,
        returnDate: intent?.returnTo?.date,
        returnMeal: intent?.returnTo?.meal,
      },
    }),
    detail: (foodId) => groupLink('food', groupSlug, { foodId }),
    edit: (foodId) => groupLink('editFood', groupSlug, { foodId }),
  }
}
