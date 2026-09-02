/**
 * Every Group URL in the app is built here.
 *
 * ADR-0002 makes the Group an addressable part of the URL, which only holds if
 * the slug goes in the same way everywhere. String concatenation at call sites
 * is how `/g/${slug}/nutrition` quietly becomes `/g//nutrition` for one caller
 * and `/g/slug/nutrition/` for another, and how a route rename turns into a
 * runtime 404 instead of a type error.
 *
 * The definition below is a `satisfies LinkProps['to']`, so TanStack Router
 * checks each destination against the generated route tree at compile time. Add
 * a surface here and the router validates it; add a Module route without one
 * and there is no way to link to it.
 */

import type { LinkProps } from '@tanstack/react-router'
import type { AppLink } from './appLink'

/**
 * The Group-scoped destinations that exist. `home` is the Group's landing page;
 * every other key is somewhere inside a Module.
 *
 * Detail and edit pages are declared here too, `$recipeId` and all, rather than
 * being assembled from an index path plus an id at the call site — the id is
 * exactly the part a hand-built path gets wrong.
 */
const GROUP_ROUTES = {
  home: '/home',
  // Every Module in the Group, pinned or not. A real page rather than a
  // collapsed sidebar section, so the mobile dock's last slot has somewhere to
  // go and both surfaces can be the same shape.
  all: '/all',
  // The Group's own settings, as against `/settings`, which is yours. What
  // belongs here is whatever a Group owns and its Members share — today, the
  // connections to Notion and Todoist that its linked task lists read through.
  settings: '/group-settings',
  nutrition: '/nutrition',
  // Adding food is a place, not a dialog: the sheet has an address so the back
  // gesture closes it and a reload does not lose it. Which day and which meal
  // ride in the search, not the path — they are what is being added *to*.
  addFood: '/nutrition/add',
  // The Combos library. A sibling of the diary rather than a page beneath it:
  // `/nutrition` is a layout that renders the diary itself so the add sheet can
  // sit over a page that never went away, and a library nested under it would
  // open below the whole day. Foods is next to Nutrition for the same reason
  // and reached from the same place, so the two match.
  combos: '/combos',

  recipes: '/recipes',
  newRecipe: '/recipes/new',
  recipe: '/recipes/$recipeId',
  editRecipe: '/recipes/$recipeId/edit',

  foods: '/foods',
  newFood: '/foods/new',
  food: '/foods/$foodId',
  editFood: '/foods/$foodId/edit',

  baby: '/baby',
  newChild: '/baby/new',
  child: '/baby/$babyId',
  editChild: '/baby/$babyId/edit',

  tasks: '/tasks',

  // The Modules that are declared but not built yet. They live under the Group
  // like every other Module rather than at a flat path of their own, so that
  // "which Group am I in?" has the same answer on a placeholder as it does on
  // Recipes — and so that nothing has to move when one of them grows a page.
  mealPlanner: '/meal-planner',
  groceries: '/groceries',
  pantry: '/pantry',
  finances: '/finances',
  calendar: '/calendar',
  notes: '/notes',
  cheeses: '/cheeses',
  wines: '/wines',
  beers: '/beers',
} as const satisfies Record<string, LinkProps['to']>

/** A page that exists inside a Group. */
export type GroupSurface = keyof typeof GROUP_ROUTES

export const GROUP_SURFACES = Object.keys(GROUP_ROUTES) as GroupSurface[]

/**
 * The `$name` segments a route path declares, read straight off the path.
 *
 * Derived rather than listed, so a destination and the params it needs can
 * never disagree: change `/recipes/$recipeId` and every caller has to change
 * with it.
 */
type PathParams<T extends string> =
  T extends `${string}$${infer P}/${infer Rest}`
    ? { [K in P]: string } & PathParams<`/${Rest}`>
    : T extends `${string}$${infer P}`
      ? { [K in P]: string }
      : Record<never, string>

/** Every path parameter a surface needs. */
export type GroupParams<S extends GroupSurface> = PathParams<
  (typeof GROUP_ROUTES)[S]
>

/** What a surface needs beyond the Group itself — a recipe id, a baby id, … */
type ExtraParams<S extends GroupSurface> = GroupParams<S>

/**
 * The builders' third argument: required for a surface that takes a param of
 * its own, and not accepted at all for one that does not.
 */
type ExtraArgs<S extends GroupSurface> = keyof ExtraParams<S> extends never
  ? []
  : [ExtraParams<S>]

/**
 * A Module's own front page inside a Group, plus the pages the Group itself
 * owns: its landing page, the list of every Module in it, and its settings.
 *
 * These are the destinations something generic — the Group switcher, the
 * sidebar — can send you to knowing only which page you were on and which
 * Group you want. They take no parameter beyond the slug, which is exactly what
 * makes them safe to reach for when the id you were looking at belongs to a
 * different Group.
 *
 * Listed rather than derived, because "front page" is a claim about what a URL
 * means and not something a path shape can be read off: `/recipes/new` needs no
 * parameter either, and is nowhere anyone should be sent by default. A test
 * holds the list to one segment deep.
 *
 * `settings` earns its place for the same reason `home` and `all` do: it means
 * something in every Group, and someone comparing two households' connections
 * wants the switcher to land them on the other household's settings rather than
 * on its Home.
 */
const GROUP_MODULE_INDEXES = [
  'home',
  'all',
  'settings',
  'nutrition',
  'combos',
  'recipes',
  'foods',
  'baby',
  'tasks',
  'mealPlanner',
  'groceries',
  'pantry',
  'finances',
  'calendar',
  'notes',
  'cheeses',
  'wines',
  'beers',
] as const satisfies readonly GroupSurface[]

export type GroupModuleIndex = (typeof GROUP_MODULE_INDEXES)[number]

export const GROUP_MODULE_INDEX_SURFACES: readonly GroupModuleIndex[] =
  GROUP_MODULE_INDEXES

/**
 * `<Link>` / `navigate` options for a Group destination. The `to` keeps its
 * literal type, so the router still type-checks the route at the call site:
 *
 * ```tsx
 * <Link {...groupLink('nutrition', group.slug)}>Nutrition</Link>
 * <Link {...groupLink('recipe', group.slug, { recipeId })}>Open</Link>
 * ```
 */
export interface GroupLinkOptions<S extends GroupSurface = GroupSurface> {
  to: (typeof GROUP_ROUTES)[S]
  params: GroupParams<S>
}

export function groupLink<S extends GroupSurface>(
  surface: S,
  _groupSlug: string,
  ...rest: ExtraArgs<S>
): GroupLinkOptions<S> {
  return {
    to: GROUP_ROUTES[surface],
    // The surface fixes exactly which params exist and `ExtraArgs` makes the
    // caller supply them; TypeScript cannot see that through the generic, which
    // is why the assertion lives here and at no call site.
    params: extraOf(rest) as GroupParams<S>,
  }
}

/**
 * The same destination as a plain string, for the places that cannot take link
 * options — a `redirect`, a `window.location`, a test. Derived from the same
 * definition, so the two can never disagree.
 */
export function groupHref<S extends GroupSurface>(
  surface: S,
  _groupSlug: string,
  ...rest: ExtraArgs<S>
): string {
  const params: Record<string, string> = { ...extraOf(rest) }
  return GROUP_ROUTES[surface].replace(/\$(\w+)/g, (whole, name: string) =>
    name in params ? encodeURIComponent(params[name]) : whole,
  )
}

function extraOf<S extends GroupSurface>(
  rest: ExtraArgs<S>,
): Record<string, string> {
  const [extra] = rest as [Record<string, string>?]
  return extra ?? {}
}

/**
 * The first path segment a surface occupies under `/g/<slug>/`, or the empty
 * string for the landing page. This is the segment that has to stay clear of
 * every other Group-level route — see `groupPaths.segments.test.ts`.
 */
export function groupSurfaceSegment(surface: GroupSurface): string {
  return GROUP_ROUTES[surface].split('/').filter(Boolean)[0] ?? ''
}

/** The Group a path addresses, or null when the path is not Group-scoped. */
/**
 * The Module index a Group-scoped path sits under, ignoring which Group it is
 * in — what the switcher needs to land you on the same Module in a different
 * Group. Null for a path that is not Group-scoped, or one whose Module has no
 * Group-scoped route yet.
 *
 * Deliberately the *index*, never the exact page: an id means nothing in
 * another Group, so switching from `/g/a/recipes/<id>` lands on `/g/b/recipes`
 * rather than carrying an id across the boundary it is meaningless outside of.
 */
export function groupIndexSurfaceOf(pathname: string): GroupModuleIndex | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  return (
    GROUP_MODULE_INDEXES.find((surface) => {
      const route = GROUP_ROUTES[surface]
      return path === route || path.startsWith(`${route}/`)
    }) ?? null
  )
}

/**
 * Where each Module lives inside a Group, keyed by `ModuleDef.id`.
 *
 * Total over `MODULES` — every Module has a Group surface, and a test holds it
 * that way. This is the only place a Module's URL is written down; the registry
 * itself carries no path, so there is nothing for the two to disagree about.
 */
const MODULE_INDEX_SURFACES: Record<string, GroupModuleIndex> = {
  recipes: 'recipes',
  nutrition: 'nutrition',
  tasks: 'tasks',
  'baby-log': 'baby',
  'meal-planner': 'mealPlanner',
  groceries: 'groceries',
  pantry: 'pantry',
  finances: 'finances',
  calendar: 'calendar',
  notes: 'notes',
  cheeses: 'cheeses',
  wines: 'wines',
  beers: 'beers',
}

export function groupSurfaceForModule(
  moduleId: string,
): GroupModuleIndex | null {
  return MODULE_INDEX_SURFACES[moduleId] ?? null
}

/**
 * The first segment a Module occupies under `/g/<slug>/` — `recipes` for
 * Recipes, `baby` for the Baby log.
 *
 * Read off the surface rather than stored on the Module, so there is one place
 * a Module's address is written and nothing for a second copy to drift from.
 * The empty string for an id no Module declares.
 */
export function moduleSegment(moduleId: string): string {
  const surface = groupSurfaceForModule(moduleId)
  return surface ? groupSurfaceSegment(surface) : ''
}

/**
 * Where a Module link goes from a Group.
 *
 * The shell renders above the route it is showing, so its Module links are the
 * one kind a route cannot build: the sidebar and the command palette are on
 * screen whichever page you are on. They read the Group off the URL — the shell
 * is allowed to, because the URL is the only thing that says which Group you
 * are in, and it is the shell's job to reflect it — and pass it here.
 *
 * The Group is required. There used to be a flat path to fall back to for a
 * Module that had no Group surface yet; there is neither now, so a Module link
 * can only be built by somebody who knows which Group they are asking about.
 * The one caller that could not — the shell, off a Group route — renders no
 * Module links at all rather than inventing a Group to point at.
 */
export function moduleLink(module: { id: string }, groupSlug: string): AppLink {
  // Every Module resolves to a surface — `MODULE_INDEX_SURFACES` is total over
  // `MODULES` and a test holds it that way — so this only stands in for an id
  // no Module declares, and All is the page that lists every Module there is.
  return groupLink(groupSurfaceForModule(module.id) ?? 'all', groupSlug)
}
