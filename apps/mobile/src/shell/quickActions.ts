import {
  MODULES,
  type ModuleGroup,
  type ModuleIconName,
  type ModuleId,
} from '@gather/core/modules'
import type { TastingKind } from '@gather/core/tastings'
import type { Href } from 'expo-router'

import { moduleHref } from '../modules/moduleDestination'

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
 * order. An empty list is an answer: adding a Module is a compile error until
 * somebody decides whether it has a verb, as with `DROP_TARGETS`.
 *
 * Only currently working flows appear until each Module owns its real one.
 * Writing a recipe from blank is not here: the Add tab is for capture — you
 * found a thing, and it is in your hand — and a blank recipe form is the
 * opposite of that. It is reachable one level in, behind the collection's own
 * add control (`AddRecipeSheet`): **reachable, and not advertised.**
 */
const ACTIONS_BY_MODULE: Record<ModuleId, readonly QuickActionDef[]> = {
  /**
   * Three rows, not one "Tasting" row plus a Kind step: the launcher is a flat
   * list of verbs, and a Kind chooser would cost everyone a tap to save three
   * rows nobody minds.
   */
  cheeses: [{ id: 'cheese-tasting', kind: 'compose', tastingKind: 'cheese' }],
  wines: [{ id: 'wine-tasting', kind: 'compose', tastingKind: 'wine' }],
  beers: [{ id: 'beer-tasting', kind: 'compose', tastingKind: 'beer' }],
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
  'meal-planner': [],
  groceries: [],
  pantry: [],
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
