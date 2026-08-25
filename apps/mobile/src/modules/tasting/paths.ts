/**
 * Where a tasting screen can send you, given which tab it is mounted under.
 *
 * Modules live inside the tab stacks (ADR-0023), so every screen here exists at
 * two addresses — under Home and under All — and each keeps its own back stack.
 * The screens take a `base` and build from it, exactly as the Baby log's
 * `paths.ts` does, which is what lets one component serve both route trees.
 *
 * **The Kind is a path segment and never a query param.** Three Modules share
 * one implementation, and the thing that decides which one you are looking at
 * has to be the address — otherwise `/wines` could be made to render a cheese
 * by a stale param. `tastingKindFromRoute` is the door: an unrecognised segment
 * is not a Kind, and the screen redirects rather than guessing.
 *
 * The cast is the price of a shared component, and it lives here alone: typed
 * routes cannot check a template string, and one place assembling paths by hand
 * beats every call site doing it.
 */
import {
  isTastingKind,
  TASTING_KIND_SPECS,
  type TastingKind,
} from '@gather/core/tastings'
import type { Href } from 'expo-router'

/** The tab stacks these Modules are mounted in. */
export type TastingTab = 'all'
export type TastingBase = '/all/tasting'

export const TASTING_BASES: Record<TastingTab, TastingBase> = {
  all: '/all/tasting',
}

export type TastingScreen = '' | '/subject' | '/compose'

export function tastingHref(
  base: TastingBase,
  kind: TastingKind,
  screen: TastingScreen,
  params?: Record<string, string>,
): Href {
  const path = `${base}/${kind}${screen}`
  return (params ? { pathname: path, params } : path) as Href
}

/** The tab a `base` belongs to, for a screen that has to hand one on. */
export function tabOf(_base: TastingBase): TastingTab {
  return 'all'
}

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
