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
export interface FoodNav {
  list: AppLink
  /** Adding a food, optionally prefilled from a scanned barcode. */
  create: (barcode?: string) => AppLink
  detail: (foodId: string) => AppLink
  edit: (foodId: string) => AppLink
}

export const flatFoodNav: FoodNav = {
  list: { to: '/foods' },
  create: (barcode) => ({ to: '/foods/new', search: { barcode } }),
  detail: (foodId) => ({ to: '/foods/$foodId', params: { foodId } }),
  edit: (foodId) => ({ to: '/foods/$foodId/edit', params: { foodId } }),
}

export function groupFoodNav(groupSlug: string): FoodNav {
  return {
    list: groupLink('foods', groupSlug),
    create: (barcode) => ({
      ...groupLink('newFood', groupSlug),
      search: { barcode },
    }),
    detail: (foodId) => groupLink('food', groupSlug, { foodId }),
    edit: (foodId) => groupLink('editFood', groupSlug, { foodId }),
  }
}
