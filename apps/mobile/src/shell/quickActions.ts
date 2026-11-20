import type { SortableLoyaltyCard } from '@gather/core/loyalty-cards'
import {
  MODULES,
  type ModuleGroup,
  type ModuleIconName,
  type ModuleId,
} from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import { moduleHref } from '../modules/moduleDestination'
import { isAccessibilityTextSize } from '../ui/text-scale'

/**
 * How far a Module's quick action can proceed inside the launcher.
 *
 * `compose` is the tasting Modules' kind (#199): the launcher
 * carries the *first* step — choosing what you tasted, which is a search and a
 * list and wants a keyboard — and then hands off to a pushed screen for the
 * rating, which does not fit above one. Neither `sheet` nor `handoff` on its
 * own describes that, and calling it either would have made the launcher lie
 * about where you are about to end up.
 */
export type QuickActionKind = 'row' | 'handoff' | 'compose'

export type QuickActionId =
  | 'task-new'
  | 'recipe-import'
  | 'loyalty-card-add'
  | 'cheese-tasting'
  | 'wine-tasting'
  | 'beer-tasting'

/**
 * The action owns its kind; the launcher only supplies the presentation that
 * kind asks for. Copy is resolved by the mobile message tree so
 * this portable seam remains data, not an English-only UI description.
 */
type QuickActionDef = { id: QuickActionId } & (
  /** `row` expands into its form under the row, in the launcher. */
  | { kind: 'row' }
  /** `tastingKind` is which Kind the subject step is picking. */
  | { kind: 'compose'; tastingKind: TastingKind }
  /** `href` is the Module's own screen, which the launcher hands over to. */
  | { kind: 'handoff'; href: Href }
)

/** An action with the Module it belongs to, whose tint and icon it wears. */
export type QuickAction = QuickActionDef & {
  module: ModuleId
  group: ModuleGroup
  icon: ModuleIconName
}

/**
 * Every Module, and the capture verbs it puts on the Add tab, in launcher
 * order: task, recipe import and card scan first, then the tastings, as on the
 * approved quick-actions artboard (APP-206). An empty list is an answer:
 * adding a Module is a compile error until somebody decides whether it has a
 * verb, as with `DROP_TARGETS`.
 *
 * Only currently working flows appear until each Module owns its real one.
 * Writing a recipe from blank is not here: the Add tab is for capture — you
 * found a thing, and it is in your hand — and a blank recipe form is the
 * opposite of that. It is reachable one level in, behind the collection's own
 * add control (`AddRecipeSheet`): **reachable, and not advertised.**
 */
const ACTIONS_BY_MODULE: Record<ModuleId, readonly QuickActionDef[]> = {
  tasks: [{ id: 'task-new', kind: 'row' }],
  recipes: [
    // An import is a *reading* of a page, partly parsed and partly guessed,
    // and it has to be shown to somebody before it becomes a recipe. That
    // review does not fit in a launcher, so the launcher hands over to the
    // Module's own screen.
    {
      id: 'recipe-import',
      kind: 'handoff',
      href: moduleHref('/all/recipes/import'),
    },
  ],
  // A card in the hand is capture: the launcher hands over to the scanner,
  // which is a whole screen of camera and does not fit under a row.
  'loyalty-cards': [
    {
      id: 'loyalty-card-add',
      kind: 'handoff',
      href: moduleHref('/all/loyalty-cards/new'),
    },
  ],
  /**
   * Three rows, not one "Tasting" row plus a Kind step: the launcher is a flat
   * list of verbs, and a Kind chooser would cost everyone a tap to save three
   * rows nobody minds.
   */
  cheeses: [{ id: 'cheese-tasting', kind: 'compose', tastingKind: 'cheese' }],
  wines: [{ id: 'wine-tasting', kind: 'compose', tastingKind: 'wine' }],
  beers: [{ id: 'beer-tasting', kind: 'compose', tastingKind: 'beer' }],
  'meal-planner': [],
  groceries: [],
  'recurring-costs': [],
  'shared-costs': [],
  'savings-goals': [],
  'baby-log': [],
  calendar: [],
  notes: [],
}

const LAUNCHER_ORDER: readonly string[] = Object.keys(ACTIONS_BY_MODULE)

export const QUICK_ACTIONS: readonly QuickAction[] = MODULES.flatMap(
  ({ id, group, icon }) =>
    ACTIONS_BY_MODULE[id].map((action) => ({
      ...action,
      module: id,
      group,
      icon,
    })),
).sort(
  (a, b) => LAUNCHER_ORDER.indexOf(a.module) - LAUNCHER_ORDER.indexOf(b.module),
)

/**
 * What the sheet's Loyalty cards section draws (APP-206), from its three
 * sources, best first:
 *
 * - `live`: Convex's answer, with usage, so it can say when each card was
 *   last used.
 * - `shown`: `useQuery`'s answer, which is `live` or the last-known copy
 *   while that answer is on its way.
 * - `saved`: this Group's offline copy (`offlineGroupCards`), for a sheet
 *   opened while Convex cannot answer at all. `undefined` is no copy.
 *
 * Every source is already in the list's order (Convex sorts it, the offline
 * copy keeps that order), so the cards come out as they went in: re-sorting
 * here would drop a Group's own arrangement, which the server keeps to itself
 * (APP-440).
 *
 * Nothing yet is `loading`, which draws placeholders in the section only: the
 * Add section never waits for cards.
 */
export type QuickCardsSection<T> =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'cards'; cards: T[]; usageKnown: boolean }

export function quickCardsSection<T extends SortableLoyaltyCard>(sources: {
  live: readonly T[] | undefined
  shown: readonly T[] | undefined
  saved: readonly T[] | undefined
}): QuickCardsSection<T> {
  const cards = sources.live ?? sources.shown ?? sources.saved
  if (cards === undefined) return { kind: 'loading' }
  if (cards.length === 0) return { kind: 'empty' }
  const usageKnown = sources.live !== undefined
  return { kind: 'cards', cards: [...cards], usageKnown }
}

/**
 * The Add grid's columns: three, and two at the accessibility text sizes,
 * where a third column leaves a label a word per line.
 */
export function quickGridColumns(fontScale: number): 2 | 3 {
  return isAccessibilityTextSize(fontScale) ? 2 : 3
}

/**
 * The actions in rows of `columns`, the last row padded with `null` so its
 * tiles keep the width of the ones above them.
 */
export function quickGridRows<T>(
  items: readonly T[],
  columns: number,
): (T | null)[][] {
  const rows: (T | null)[][] = []
  for (let start = 0; start < items.length; start += columns) {
    const row: (T | null)[] = items.slice(start, start + columns)
    while (row.length < columns) row.push(null)
    rows.push(row)
  }
  return rows
}

/**
 * One column's width in a grid `width` wide, so every tile in the grid is the
 * same width whatever its label. `undefined` before the grid is measured.
 */
export function quickTileWidth(
  width: number,
  columns: number,
  gap: number,
): number | undefined {
  if (width <= 0) return undefined
  return Math.floor((width - gap * (columns - 1)) / columns)
}
