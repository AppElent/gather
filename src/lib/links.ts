/**
 * Every in-app destination is named here, once.
 *
 * The Current Group is ambient (ADR-0031): no address says which Group it is
 * in, so a link is a route and its params and nothing else. Moving to another
 * Group is `setCurrentGroup`, never a link.
 *
 * The tables are `satisfies LinkProps['to']`, so TanStack Router checks each
 * destination against the generated route tree at compile time, and a route
 * rename is a type error rather than a runtime 404.
 */

import type { MealName } from '@gather/core/domain'
import { MODULES, type ModuleId } from '@gather/core/modules'
import type { LinkProps } from '@tanstack/react-router'

/** `<Link>` / `navigate` options, with `to` checked against the route tree. */
export type AppLink = Pick<LinkProps, 'to' | 'params' | 'search' | 'hash'>

/**
 * Each Module's front page, keyed by its id. A Module with no entry here is a
 * compile error, so every Module has exactly one address.
 */
const MODULE_ROUTES = {
  recipes: '/recipes',
  nutrition: '/nutrition',
  tasks: '/tasks',
  'baby-log': '/baby',
  'meal-planner': '/meal-planner',
  groceries: '/groceries',
  pantry: '/pantry',
  'recurring-costs': '/recurring-costs',
  'shared-costs': '/shared-costs',
  'savings-goals': '/savings-goals',
  calendar: '/calendar',
  notes: '/notes',
  cheeses: '/cheeses',
  wines: '/wines',
  beers: '/beers',
} as const satisfies Record<ModuleId, LinkProps['to']>

/**
 * Detail and edit pages are declared here too, `$recipeId` and all, rather than
 * being assembled from an index path plus an id at the call site — the id is
 * exactly the part a hand-built path gets wrong.
 */
export const ROUTES = {
  ...MODULE_ROUTES,
  home: '/home',
  // Every Module in the Group, pinned or not. A real page rather than a
  // collapsed sidebar section, so the mobile dock's last slot has somewhere to
  // go and both surfaces can be the same shape.
  all: '/all',
  // The Current Group's own settings, as against `settings`, which are yours.
  groupSettings: '/group-settings',
  settings: '/settings',
  account: '/account',
  groups: '/groups',

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

  newRecipe: '/recipes/new',
  recipe: '/recipes/$recipeId',
  editRecipe: '/recipes/$recipeId/edit',

  foods: '/foods',
  newFood: '/foods/new',
  food: '/foods/$foodId',
  editFood: '/foods/$foodId/edit',

  newChild: '/baby/new',
  child: '/baby/$babyId',
  editChild: '/baby/$babyId/edit',

  cheese: '/cheeses/$subjectId',
  editCheese: '/cheeses/$subjectId/edit',
  wine: '/wines/$subjectId',
  editWine: '/wines/$subjectId/edit',
  beer: '/beers/$subjectId',
  editBeer: '/beers/$subjectId/edit',
} as const satisfies Record<string, LinkProps['to']>

export type Surface = keyof typeof ROUTES

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
export type SurfaceParams<S extends Surface> = PathParams<(typeof ROUTES)[S]>

/**
 * The builders' second argument: required for a surface that takes a param,
 * and not accepted at all for one that does not.
 */
type ExtraArgs<S extends Surface> = keyof SurfaceParams<S> extends never
  ? []
  : [SurfaceParams<S>]

/**
 * The front pages of the Current Group: its landing page, the list of every
 * Module in it, its settings, the two libraries beside the diary, and every
 * Module's index.
 *
 * These are the destinations something generic — the Group switcher, the
 * sidebar — can send you to knowing only which page you were on. They take no
 * parameter, which is exactly what makes them safe to reach for after a Group
 * switch, when the id you were looking at belongs to the Group you left.
 */
const INDEX_SURFACES = [
  'home',
  'all',
  'groupSettings',
  'combos',
  'foods',
  ...(Object.keys(MODULE_ROUTES) as ModuleId[]),
] as const satisfies readonly Surface[]

export type IndexSurface = (typeof INDEX_SURFACES)[number]

/**
 * `<Link>` / `navigate` options for a destination. The `to` keeps its literal
 * type, so the router still type-checks the route at the call site:
 *
 * ```tsx
 * <Link {...linkTo('nutrition')}>Nutrition</Link>
 * <Link {...linkTo('recipe', { recipeId })}>Open</Link>
 * ```
 */
export function linkTo<S extends Surface>(
  surface: S,
  ...rest: ExtraArgs<S>
): { to: (typeof ROUTES)[S]; params: SurfaceParams<S> } {
  return {
    to: ROUTES[surface],
    // The surface fixes exactly which params exist and `ExtraArgs` makes the
    // caller supply them; TypeScript cannot see that through the generic, which
    // is why the assertion lives here and at no call site.
    params: extraOf(rest) as SurfaceParams<S>,
  }
}

/**
 * The same destination as a plain string, for the places that cannot take link
 * options — a `redirect`, a `window.location`, a value kept across an OAuth
 * round-trip. Derived from the same definition, so the two can never disagree.
 */
export function hrefTo<S extends Surface>(
  surface: S,
  ...rest: ExtraArgs<S>
): string {
  const params: Record<string, string> = { ...extraOf(rest) }
  return ROUTES[surface].replace(/\$(\w+)/g, (whole, name: string) =>
    name in params ? encodeURIComponent(params[name]) : whole,
  )
}

function extraOf<S extends Surface>(
  rest: ExtraArgs<S>,
): Record<string, string> {
  const [extra] = rest as [Record<string, string>?]
  return extra ?? {}
}

/**
 * The front page a path sits under: `recipes` for `/recipes/r1/edit`, `home`
 * for `/home`. Null for a path that is under none, such as `/settings`.
 *
 * What the switcher needs to land on the same Module in another Group, and
 * what the shell needs to say which navigation item and title a page has.
 * Deliberately the *index*, never the exact page: an id means nothing in
 * another Group.
 */
export function indexSurfaceOf(pathname: string): IndexSurface | null {
  const path = pathname.split('#')[0].replace(/\/+$/, '') || '/'
  return (
    INDEX_SURFACES.find((surface) => {
      const route = ROUTES[surface]
      return path === route || path.startsWith(`${route}/`)
    }) ?? null
  )
}

/**
 * The front pages of a Personal Module and the libraries beside its diary.
 * They belong to the person, not a Group, so they work for somebody in none.
 */
const PERSONAL_SURFACES: ReadonlySet<IndexSurface> = new Set<IndexSurface>([
  ...MODULES.filter((module) => module.scope === 'personal').map(
    (module) => module.id,
  ),
  'foods',
  'combos',
])

/** Whether a page sits under one of the Current Group's front pages. */
export function needsCurrentGroup(pathname: string): boolean {
  const surface = indexSurfaceOf(pathname)
  return surface !== null && !PERSONAL_SURFACES.has(surface)
}

/** Where a Module link goes. */
export function moduleLink(module: { id: string }): AppLink {
  // `ModuleDef.id` is `string` only because `moduleById` accepts stored strings;
  // every `ModuleDef` in circulation came out of `MODULES`.
  return linkTo(module.id as ModuleId)
}

/**
 * The add sheet, which is an address of its own carrying the day and the meal.
 *
 * `foodId` is the food a just-finished form handed back: the sheet opens with
 * that card expanded and ready to log, which is what makes reviewing an import
 * feel like a step in logging rather than a detour through the Catalog.
 */
export function addFoodLink(
  date: string,
  meal: MealName,
  foodId?: string,
): AppLink {
  return {
    ...linkTo('addFood'),
    // The food only when there is one: a key carrying `undefined` is a query
    // parameter in some serialisers and nothing in others, and the sheet's
    // address should not depend on which.
    search: { date, meal, ...(foodId ? { food: foodId } : {}) },
  }
}

/**
 * What is already known about the food somebody is about to add.
 *
 * All three parts are optional and independent: a scan knows the barcode, a
 * search that found nothing knows the words that were typed, and either can
 * have been reached from somewhere that wants the person back afterwards.
 *
 * `returnTo` is deliberately the *day and meal*, not a URL: the only place that
 * sends anyone here expecting them back is the add sheet, which is addressable
 * by exactly those two (#66). Keeping it as data rather than as a serialised
 * link is what stops an arbitrary destination riding in on a query string.
 */
export interface NewFoodIntent {
  barcode?: string
  /** Prefills the name — the term a search matched nothing for (#79). */
  name?: string
  returnTo?: { date: string; meal: string }
}

/** Adding a food, optionally prefilled and optionally with a way back. */
export function newFoodLink(intent?: NewFoodIntent): AppLink {
  return {
    ...linkTo('newFood'),
    // Only the parts there are: `/foods/new` with no intent is one address
    // rather than four spellings of it.
    search: {
      ...(intent?.barcode ? { barcode: intent.barcode } : {}),
      ...(intent?.name ? { name: intent.name } : {}),
      ...(intent?.returnTo
        ? {
            returnDate: intent.returnTo.date,
            returnMeal: intent.returnTo.meal,
          }
        : {}),
    },
  }
}

/**
 * Where the nutrition targets form sits on `/settings`. The diary links to it
 * and the form carries it as its id: a hash that matches nothing fails
 * silently, so both read it from here.
 */
export const NUTRITION_TARGETS_ANCHOR = 'nutrition-targets'
