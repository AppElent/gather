import type { ModuleGroup, ModuleIconName } from '@gather/core/modules'

/** How far a Module's quick action can proceed inside the launcher. */
export type QuickActionKind = 'row' | 'sheet' | 'handoff'

export type QuickActionId =
  | 'task-new'
  | 'recipe-import'
  | 'meal-log'
  | 'recipe-new'
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
}

/** Only currently working demo flows appear until each Module owns its real one. */
export const QUICK_ACTIONS = [
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
