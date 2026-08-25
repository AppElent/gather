/**
 * The two addresses the Drop flow has.
 *
 * The cast is the one every Module's `paths.ts` explains: typed routes cannot
 * check a template string, and these two screens are generated route files that
 * the router only learns about when Metro regenerates its types. One place
 * assembling them by hand beats a cast at every call site.
 *
 * The flow lives above the tabs rather than inside one, because a Drop belongs
 * to no tab: it arrives from another app entirely, and the tab somebody
 * happened to leave open says nothing about where what they shared should go.
 */
import type { Href } from 'expo-router'

import type { DropTargetId } from './dropTargets'

/**
 * The flow's own segment, held as a plain string on purpose.
 *
 * A literal would be checked against the generated route union, which is
 * rebuilt by Metro rather than by `tsc` — so a freshly added route file makes
 * the typecheck fail on a path that is perfectly real. Widening here is the
 * same accommodation every `paths.ts` in this app makes for the same reason.
 */
const DROP = '/drop'

/** Stage one: where does this go? */
export function dropHref(): Href {
  return DROP as Href
}

/**
 * Stage two: which note, which list, which recipe, which cheese.
 *
 * The Group travels with it. Stage one is where a Drop is aimed, and the app
 * has not moved there yet — so the address carries the answer rather than stage
 * two reading an ambient Group that is still the old one (ADR-0007).
 */
export function dropPickHref(target: DropTargetId, groupSlug: string): Href {
  const path: string = `${DROP}/pick`
  return { pathname: path, params: { target, groupSlug } } as Href
}
