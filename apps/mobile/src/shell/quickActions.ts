import type { ModuleGroup, ModuleIconName } from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'

/**
 * How far a Module's quick action can proceed inside the launcher.
 *
 * `compose` is the fourth, added by the tasting Modules (#199): the launcher
 * carries the *first* step — choosing what you tasted, which is a search and a
 * list and wants a keyboard — and then hands off to a pushed screen for the
 * rating, which does not fit above one. Neither `sheet` nor `handoff` on its
 * own describes that, and calling it either would have made the launcher lie
 * about where you are about to end up.
 */
export type QuickActionKind = 'row' | 'sheet' | 'handoff' | 'compose'

export type QuickActionId =
  | 'task-new'
  | 'recipe-import'
  | 'meal-log'
  | 'recipe-new'
  | 'food-scan'
  | 'cheese-tasting'
  | 'wine-tasting'
  | 'beer-tasting'

/**
 * The action owns its kind; the launcher only supplies the presentation that
 * kind asks for. Copy and fields are resolved by the mobile message tree so
 * this portable seam remains data, not an English-only UI description.
 */
export interface QuickAction {
  id: QuickActionId
  module: 'tasks' | 'recipes' | 'nutrition' | 'cheeses' | 'wines' | 'beers'
  group: ModuleGroup
  icon: ModuleIconName
  kind: QuickActionKind
  /** `compose` only: which Kind the subject step is picking. */
  tastingKind?: TastingKind
}

/** Only currently working demo flows appear until each Module owns its real one. */
export const QUICK_ACTIONS = [
  /**
   * Three rows, not one "Tasting" row plus a Kind step: the launcher is a flat
   * list of verbs, and a Kind chooser would cost everyone a tap to save three
   * rows nobody minds.
   */
  {
    id: 'cheese-tasting',
    module: 'cheeses',
    group: 'tasting',
    icon: 'Grape',
    kind: 'compose',
    tastingKind: 'cheese',
  },
  {
    id: 'wine-tasting',
    module: 'wines',
    group: 'tasting',
    icon: 'Wine',
    kind: 'compose',
    tastingKind: 'wine',
  },
  {
    id: 'beer-tasting',
    module: 'beers',
    group: 'tasting',
    icon: 'Beer',
    kind: 'compose',
    tastingKind: 'beer',
  },
  {
    id: 'task-new',
    module: 'tasks',
    group: 'home',
    icon: 'ListChecks',
    kind: 'row',
  },
  {
    id: 'recipe-import',
    module: 'recipes',
    group: 'kitchen',
    icon: 'ChefHat',
    kind: 'sheet',
  },
  {
    id: 'meal-log',
    module: 'nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'sheet',
  },
  {
    id: 'recipe-new',
    module: 'recipes',
    group: 'kitchen',
    icon: 'ChefHat',
    kind: 'handoff',
  },
  {
    id: 'food-scan',
    module: 'nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'handoff',
  },
] as const satisfies readonly QuickAction[]
