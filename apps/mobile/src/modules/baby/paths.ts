/**
 * Where a Baby log screen can send you, given which tab it is mounted under.
 *
 * Modules live inside the tab stacks (ADR-0023), so every screen in this Module
 * exists at two addresses — under Home and under All — and each keeps its own
 * back stack. The screens themselves must not know which: they take a `base`
 * and build from it, which is what lets one component serve both route trees
 * instead of one per tab.
 *
 * The cast is the price of that, and it lives here alone. Typed routes cannot
 * check a template string, so this function is the single place where a path is
 * assembled by hand — and the `BabyBase` union is what keeps the two halves of
 * it honest, since a tab that has no `baby-log/` subtree cannot be named.
 */
import type { Href } from 'expo-router'

/** The tab stacks this Module is mounted in. */
export type BabyBase = '/home/baby-log' | '/all/baby-log'

export type BabyScreen =
  | ''
  | '/new'
  | '/settings'
  | '/timeline'
  | '/trends'
  | '/lists'
  | '/entry'

export function babyHref(
  base: BabyBase,
  screen: BabyScreen,
  params?: Record<string, string>,
): Href {
  const path = `${base}${screen}`
  return (params ? { pathname: path, params } : path) as Href
}
