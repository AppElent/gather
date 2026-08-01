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

/** The `/g/<slug>` prefix every Group-scoped route shares. */
const GROUP_PREFIX = '/g/$groupSlug'

/**
 * The Group-scoped destinations that exist. `home` is the Group's landing page;
 * every other key is somewhere inside a Module.
 *
 * Detail and edit pages are declared here too, `$recipeId` and all, rather than
 * being assembled from an index path plus an id at the call site — the id is
 * exactly the part a hand-built path gets wrong.
 */
const GROUP_ROUTES = {
  home: GROUP_PREFIX,
  // Every Module in the Group, pinned or not. A real page rather than a
  // collapsed sidebar section, so the mobile dock's last slot has somewhere to
  // go and both surfaces can be the same shape.
  all: `${GROUP_PREFIX}/all`,
  nutrition: `${GROUP_PREFIX}/nutrition`,

  recipes: `${GROUP_PREFIX}/recipes`,
  newRecipe: `${GROUP_PREFIX}/recipes/new`,
  recipe: `${GROUP_PREFIX}/recipes/$recipeId`,
  editRecipe: `${GROUP_PREFIX}/recipes/$recipeId/edit`,

  foods: `${GROUP_PREFIX}/foods`,
  newFood: `${GROUP_PREFIX}/foods/new`,
  food: `${GROUP_PREFIX}/foods/$foodId`,
  editFood: `${GROUP_PREFIX}/foods/$foodId/edit`,

  baby: `${GROUP_PREFIX}/baby`,
  newChild: `${GROUP_PREFIX}/baby/new`,
  child: `${GROUP_PREFIX}/baby/$babyId`,
  editChild: `${GROUP_PREFIX}/baby/$babyId/edit`,

  tasks: `${GROUP_PREFIX}/tasks`,

  // The Modules that are declared but not built yet. They live under the Group
  // like every other Module rather than at a flat path of their own, so that
  // "which Group am I in?" has the same answer on a placeholder as it does on
  // Recipes — and so that nothing has to move when one of them grows a page.
  mealPlanner: `${GROUP_PREFIX}/meal-planner`,
  groceries: `${GROUP_PREFIX}/groceries`,
  pantry: `${GROUP_PREFIX}/pantry`,
  finances: `${GROUP_PREFIX}/finances`,
  bills: `${GROUP_PREFIX}/bills`,
  calendar: `${GROUP_PREFIX}/calendar`,
  notes: `${GROUP_PREFIX}/notes`,
  cheeses: `${GROUP_PREFIX}/cheeses`,
  wines: `${GROUP_PREFIX}/wines`,
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

/** Every param a surface needs, `groupSlug` included. */
export type GroupParams<S extends GroupSurface> = PathParams<
  (typeof GROUP_ROUTES)[S]
>

/** What a surface needs beyond the Group itself — a recipe id, a baby id, … */
type ExtraParams<S extends GroupSurface> = Omit<GroupParams<S>, 'groupSlug'>

/**
 * The builders' third argument: required for a surface that takes a param of
 * its own, and not accepted at all for one that does not.
 */
type ExtraArgs<S extends GroupSurface> = keyof ExtraParams<S> extends never
  ? []
  : [ExtraParams<S>]

/**
 * A Module's own front page inside a Group, plus the two pages the Group itself
 * owns: its landing page, and the list of every Module in it.
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
 */
const GROUP_MODULE_INDEXES = [
  'home',
  'all',
  'nutrition',
  'recipes',
  'foods',
  'baby',
  'tasks',
  'mealPlanner',
  'groceries',
  'pantry',
  'finances',
  'bills',
  'calendar',
  'notes',
  'cheeses',
  'wines',
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
  groupSlug: string,
  ...rest: ExtraArgs<S>
): GroupLinkOptions<S> {
  return {
    to: GROUP_ROUTES[surface],
    // The surface fixes exactly which params exist and `ExtraArgs` makes the
    // caller supply them; TypeScript cannot see that through the generic, which
    // is why the assertion lives here and at no call site.
    params: { ...extraOf(rest), groupSlug } as GroupParams<S>,
  }
}

/**
 * The same destination as a plain string, for the places that cannot take link
 * options — a `redirect`, a `window.location`, a test. Derived from the same
 * definition, so the two can never disagree.
 */
export function groupHref<S extends GroupSurface>(
  surface: S,
  groupSlug: string,
  ...rest: ExtraArgs<S>
): string {
  const params: Record<string, string> = { ...extraOf(rest), groupSlug }
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

/** Whatever a surface adds after `/g/<slug>`; the empty string for the landing page. */
function suffixOf(surface: GroupSurface): string {
  return GROUP_ROUTES[surface].slice(GROUP_PREFIX.length)
}

/**
 * The first path segment a surface occupies under `/g/<slug>/`, or the empty
 * string for the landing page. This is the segment that has to stay clear of
 * every other Group-level route — see `groupPaths.segments.test.ts`.
 */
export function groupSurfaceSegment(surface: GroupSurface): string {
  return suffixOf(surface).split('/').filter(Boolean)[0] ?? ''
}

/** `/g/<slug>` and whatever follows it, or null when a path is not Group-scoped. */
function splitGroupPath(
  pathname: string,
): { groupSlug: string; rest: string } | null {
  const match = /^\/g\/([^/]+)(\/.*)?$/.exec(pathname)
  if (!match) return null
  return {
    groupSlug: decodeURIComponent(match[1]),
    rest: (match[2] ?? '').replace(/\/+$/, ''),
  }
}

/** The Group a path addresses, or null when the path is not Group-scoped. */
export function groupSlugOf(pathname: string): string | null {
  return splitGroupPath(pathname)?.groupSlug ?? null
}

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
  const split = splitGroupPath(pathname)
  if (!split) return null
  const segment = split.rest.split('/').filter(Boolean)[0] ?? ''
  const wanted = segment === '' ? '' : `/${segment}`
  return GROUP_MODULE_INDEXES.find((s) => suffixOf(s) === wanted) ?? null
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
  bills: 'bills',
  calendar: 'calendar',
  notes: 'notes',
  cheeses: 'cheeses',
  wines: 'wines',
}

export function groupSurfaceForModule(
  moduleId: string,
): GroupModuleIndex | null {
  return MODULE_INDEX_SURFACES[moduleId] ?? null
}

/**
 * Where a Module link should go from wherever you are standing.
 *
 * The shell renders above both route trees, so its Module links are the one
 * kind that cannot be built by a route: the sidebar and the command palette are
 * on screen at `/recipes` and at `/g/<slug>/recipes` alike. They read the Group
 * off the URL — the shell is allowed to, because the URL is the only thing that
 * says which Group you are in, and it is the shell's job to reflect it — and
 * pass it here.
 *
 * Inside a Group, a Module that has a Group-scoped route keeps you in the Group
 * you are already in; anything else falls back to the flat path, so a
 * placeholder Module or a Module with no Group route yet still goes somewhere
 * that exists. That fallback disappears with the flat routes in #24.
 */
export function moduleLink(
  module: { id?: string; path: string },
  groupSlug: string | null,
): AppLink {
  const surface =
    module.id && groupSlug ? groupSurfaceForModule(module.id) : null
  if (surface && groupSlug) return groupLink(surface, groupSlug)
  // The Module registry stores its path as a plain string; the router cannot
  // check a value it never sees declared, which is the reason Group
  // destinations are declared here rather than kept alongside the Modules.
  return { to: module.path as LinkProps['to'] }
}
