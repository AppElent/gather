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

/** The `/g/<slug>` prefix every Group-scoped route shares. */
const GROUP_PREFIX = '/g/$groupSlug'

/**
 * The Group-scoped destinations that exist. `home` is the Group's landing page;
 * every other key is a Module. #23 adds recipes, foods, baby and tasks by
 * adding lines here — nothing else changes.
 */
const GROUP_ROUTES = {
  home: GROUP_PREFIX,
  nutrition: `${GROUP_PREFIX}/nutrition`,
} as const satisfies Record<string, LinkProps['to']>

/** A page that exists inside a Group. */
export type GroupSurface = keyof typeof GROUP_ROUTES

export const GROUP_SURFACES = Object.keys(GROUP_ROUTES) as GroupSurface[]

/**
 * `<Link>` / `navigate` options for a Group destination. The `to` keeps its
 * literal type, so the router still type-checks the route at the call site:
 *
 * ```tsx
 * <Link {...groupLink('nutrition', group.slug)}>Nutrition</Link>
 * ```
 */
export interface GroupLinkOptions<S extends GroupSurface = GroupSurface> {
  to: (typeof GROUP_ROUTES)[S]
  params: { groupSlug: string }
}

export function groupLink<S extends GroupSurface>(
  surface: S,
  groupSlug: string,
): GroupLinkOptions<S> {
  return { to: GROUP_ROUTES[surface], params: { groupSlug } }
}

/**
 * The same destination as a plain string, for the places that cannot take link
 * options — a `redirect`, a `window.location`, a test. Derived from the same
 * definition, so the two can never disagree.
 */
export function groupHref(surface: GroupSurface, groupSlug: string): string {
  return GROUP_ROUTES[surface].replace(
    '$groupSlug',
    encodeURIComponent(groupSlug),
  )
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
 * The surface a path is on, ignoring which Group it is in — what the switcher
 * needs to land you on the same page in a different Group. Null for a path that
 * is not Group-scoped, or one whose Module has no Group-scoped route yet.
 */
export function groupSurfaceOf(pathname: string): GroupSurface | null {
  const split = splitGroupPath(pathname)
  if (!split) return null
  return GROUP_SURFACES.find((s) => suffixOf(s) === split.rest) ?? null
}
