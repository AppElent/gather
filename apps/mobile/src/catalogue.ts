/**
 * The Module catalogue, minus everything only a signed-in phone would need.
 *
 * The front door shows the catalogue as a promise — this is what a Group gets —
 * so it needs each Module's id, its glyph and the group it is tinted by. It does
 * *not* need routes, gates or pin state, and deliberately does not carry them.
 *
 * TODO(#143): this belongs in `packages/core` — ADR-0016 puts the ids, icon
 * names and groups there precisely so the web and the phone cannot drift about
 * what the catalogue is. That package is decided and not yet built, so the list
 * is transcribed from `src/lib/modules.ts` and must be deleted, not amended,
 * when `@gather/core` lands.
 */

import type { ModuleIconName } from './theme/icons'
import type { ModuleGroup } from './theme/tokens'

export type ModuleId =
  | 'recipes'
  | 'nutrition'
  | 'meal-planner'
  | 'groceries'
  | 'pantry'
  | 'finances'
  | 'bills'
  | 'tasks'
  | 'baby-log'
  | 'calendar'
  | 'notes'
  | 'cheeses'
  | 'wines'

export interface CatalogueEntry {
  id: ModuleId
  icon: ModuleIconName
  group: ModuleGroup
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  { id: 'recipes', icon: 'ChefHat', group: 'kitchen' },
  { id: 'nutrition', icon: 'Apple', group: 'kitchen' },
  { id: 'meal-planner', icon: 'CalendarHeart', group: 'kitchen' },
  { id: 'groceries', icon: 'ShoppingCart', group: 'kitchen' },
  { id: 'pantry', icon: 'Refrigerator', group: 'kitchen' },
  { id: 'finances', icon: 'Wallet', group: 'money' },
  { id: 'bills', icon: 'Receipt', group: 'money' },
  { id: 'tasks', icon: 'ListChecks', group: 'home' },
  { id: 'baby-log', icon: 'Baby', group: 'home' },
  { id: 'calendar', icon: 'Calendar', group: 'home' },
  { id: 'notes', icon: 'NotebookPen', group: 'home' },
  { id: 'cheeses', icon: 'Grape', group: 'tasting' },
  { id: 'wines', icon: 'Wine', group: 'tasting' },
]

/** The order the four tints read in, kitchen-first, as the web's All page has them. */
export const GROUP_ORDER: readonly ModuleGroup[] = [
  'kitchen',
  'money',
  'home',
  'tasting',
]
