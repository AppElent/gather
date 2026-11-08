/**
 * The tasting Modules' route segment.
 *
 * **The Kind is a path segment and never a query param.** Three Modules share
 * one implementation, and the thing that decides which one you are looking at
 * has to be the address — otherwise `/wines` could be made to render a cheese
 * by a stale param. `tastingKindFromRoute` is the door: an unrecognised segment
 * is not a Kind, and the screen redirects rather than guessing. Addresses are
 * built with `moduleHref` (`modules/moduleDestination.ts`).
 */
import {
  isTastingKind,
  TASTING_KIND_SPECS,
  type TastingKind,
} from '@gather/core/tastings'

/**
 * The Kind a route's `[kind]` segment names, or `undefined`.
 *
 * Undefined is a redirect, never a default: falling back to cheese would make
 * a typo silently show somebody another Module's contents.
 */
export function tastingKindFromRoute(
  segment: string | undefined,
): TastingKind | undefined {
  return segment && isTastingKind(segment) ? segment : undefined
}

/** The Module a Kind is reached through — `cheeses` for `cheese`. */
export function moduleIdOf(kind: TastingKind): string {
  return TASTING_KIND_SPECS[kind].moduleId
}
