import type { ModuleGroup, ModuleIconName } from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import { ADD_TAB_BASE, recipeHref } from '../modules/recipes/paths'

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
  /**
   * Where a `handoff` goes, for a Module that has somewhere to go.
   *
   * Absent means the shared demo create screen, which is where every handoff
   * landed while no Module owned a real form. A Module that has built one
   * names it here and stops being a demo — and the launcher never learns
   * which Module it is handing to.
   */
  href?: Href
}

/**
 * Only currently working flows appear until each Module owns its real one.
 *
 * Writing a recipe from blank used to sit here and no longer does. The Add tab
 * is for capture — you found a thing, and it is in your hand — and a blank
 * recipe form is the opposite of that. It is still reachable, one level in,
 * behind the collection's own add control (`AddRecipeSheet`): **reachable, and
 * not advertised.**
 */
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
    // A real handoff now, not a text box in a sheet: an import is a *reading*
    // of a page, partly parsed and partly guessed, and it has to be shown to
    // somebody before it becomes a recipe. That review does not fit in a
    // launcher, so the launcher hands over to the Module's own screen.
    id: 'recipe-import',
    module: 'recipes',
    group: 'kitchen',
    icon: 'ChefHat',
    kind: 'handoff',
    href: recipeHref(ADD_TAB_BASE, '/import'),
  },
  {
    id: 'meal-log',
    module: 'nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'sheet',
  },
  {
    id: 'food-scan',
    module: 'nutrition',
    group: 'kitchen',
    icon: 'Apple',
    kind: 'handoff',
  },
] as const satisfies readonly QuickAction[]
