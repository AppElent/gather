import type { ModuleGroup, ModuleIconName } from '@gather/core/modules'
import type { Href } from 'expo-router'

import { ADD_TAB_BASE, recipeHref } from '../modules/recipes/paths'

/** How far a Module's quick action can proceed inside the launcher. */
export type QuickActionKind = 'row' | 'sheet' | 'handoff'

export type QuickActionId =
  | 'task-new'
  | 'recipe-import'
  | 'meal-log'
  | 'food-scan'

/**
 * The action owns its kind; the launcher only supplies the presentation that
 * kind asks for. Copy and fields are resolved by the mobile message tree so
 * this portable seam remains data, not an English-only UI description.
 */
export interface QuickAction {
  id: QuickActionId
  module: 'tasks' | 'recipes' | 'nutrition'
  group: ModuleGroup
  icon: ModuleIconName
  kind: QuickActionKind
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
