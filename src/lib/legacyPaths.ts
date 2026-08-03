/**
 * Where an address written before ADR-0002 lands now.
 *
 * The flat routes are gone, but the links people already have are not: a
 * bookmarked `/recipes/<id>`, a message with `/baby` in it, a home-screen
 * shortcut to `/dashboard`. Each of those still names a real page — it just
 * no longer says which Group the page is in, which is the one thing the new
 * address needs.
 *
 * This file answers only the half that is a pure function of the path: *which
 * page*. Which Group is a separate question with a separate answer
 * (`landingGroup.ts`), and the two are deliberately not mixed, so this can be
 * tested exhaustively without a session.
 *
 * Anything unrecognised is null, meaning the Group's Home. An old link should
 * land somewhere honest rather than on an error page, and Home is the page that
 * is true of every Group.
 */

import type { AppLink } from './appLink'
import type { GroupSurface } from './groupPaths'
import { groupLink } from './groupPaths'

/** A legacy path's Group-scoped equivalent, waiting only for the Group. */
export interface LegacyTarget {
  /** The Group surface the old path corresponds to. */
  surface: GroupSurface
  /** The same destination as link options, once the Group is known. */
  link: (groupSlug: string) => AppLink
}

/** The surfaces that need nothing beyond the Group to be addressed. */
type PlainSurface =
  | 'home'
  | 'all'
  | 'nutrition'
  | 'recipes'
  | 'newRecipe'
  | 'foods'
  | 'newFood'
  | 'baby'
  | 'newChild'
  | 'tasks'
  | 'mealPlanner'
  | 'groceries'
  | 'pantry'
  | 'finances'
  | 'bills'
  | 'calendar'
  | 'notes'
  | 'cheeses'
  | 'wines'

function plain(surface: PlainSurface): LegacyTarget {
  return { surface, link: (groupSlug) => groupLink(surface, groupSlug) }
}

/**
 * A Module whose old URLs went a level deeper: an index, a create form, a
 * record, and that record's edit form. All three of Recipes, Foods and the Baby
 * log had exactly that shape, so the shape is written once.
 */
interface DeepModule {
  index: PlainSurface
  create: PlainSurface
  detail: (id: string) => LegacyTarget
  edit: (id: string) => LegacyTarget
}

const RECIPES: DeepModule = {
  index: 'recipes',
  create: 'newRecipe',
  detail: (recipeId) => ({
    surface: 'recipe',
    link: (groupSlug) => groupLink('recipe', groupSlug, { recipeId }),
  }),
  edit: (recipeId) => ({
    surface: 'editRecipe',
    link: (groupSlug) => groupLink('editRecipe', groupSlug, { recipeId }),
  }),
}

const FOODS: DeepModule = {
  index: 'foods',
  create: 'newFood',
  detail: (foodId) => ({
    surface: 'food',
    link: (groupSlug) => groupLink('food', groupSlug, { foodId }),
  }),
  edit: (foodId) => ({
    surface: 'editFood',
    link: (groupSlug) => groupLink('editFood', groupSlug, { foodId }),
  }),
}

const BABY: DeepModule = {
  index: 'baby',
  create: 'newChild',
  detail: (babyId) => ({
    surface: 'child',
    link: (groupSlug) => groupLink('child', groupSlug, { babyId }),
  }),
  edit: (babyId) => ({
    surface: 'editChild',
    link: (groupSlug) => groupLink('editChild', groupSlug, { babyId }),
  }),
}

const DEEP_MODULES: Record<string, DeepModule> = {
  recipes: RECIPES,
  foods: FOODS,
  baby: BABY,
}

/**
 * The old paths that were one segment and nothing more.
 *
 * `/dashboard` is here because Home is genuinely what it became — the Group's
 * shared surface, under the name CONTEXT.md gives it.
 */
const FLAT_MODULES: Record<string, PlainSurface> = {
  dashboard: 'home',
  nutrition: 'nutrition',
  tasks: 'tasks',
  'meal-planner': 'mealPlanner',
  groceries: 'groceries',
  pantry: 'pantry',
  finances: 'finances',
  bills: 'bills',
  calendar: 'calendar',
  notes: 'notes',
  cheeses: 'cheeses',
  wines: 'wines',
}

/** A record id that arrived percent-encoded, or the segment as it stands. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The path's segments, with the empties dropped — which is what makes a
 * trailing slash, a doubled slash and neither of them the same path.
 */
function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map(decodeSegment)
}

function deepTarget(module: DeepModule, rest: string[]): LegacyTarget | null {
  if (rest.length === 0) return plain(module.index)
  // `new` before an id, or `/recipes/new` becomes a request for the recipe
  // called "new".
  if (rest.length === 1 && rest[0] === 'new') return plain(module.create)
  if (rest.length === 1) return module.detail(rest[0])
  if (rest.length === 2 && rest[1] === 'edit') return module.edit(rest[0])
  return null
}

/**
 * The Group-scoped page a legacy path names, or null when it names none.
 *
 * Takes a pathname only. A query string or a fragment belongs to the caller —
 * it is carried across unread, because nothing in here could say anything true
 * about it.
 */
export function legacyTarget(pathname: string): LegacyTarget | null {
  const [head, ...rest] = segmentsOf(pathname)
  if (!head) return null

  const deep = DEEP_MODULES[head]
  if (deep) return deepTarget(deep, rest)

  if (rest.length > 0) return null
  const flat = FLAT_MODULES[head]
  return flat ? plain(flat) : null
}
