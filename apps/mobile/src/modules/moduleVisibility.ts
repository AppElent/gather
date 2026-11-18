/**
 * Which Modules a build shows (App Review 2.1(a), APP-234).
 *
 * The store build shows only the Modules the catalogue marks `live`
 * (`@gather/core/modules`). Development and preview builds show every Module,
 * so work in progress stays reachable on the phones that test it. One answer
 * for every way in: All, Home's pins, Search, the quick-actions sheet, a Drop,
 * and a route opened by a link (`GroupScopedStack`).
 *
 * Pure: whether this build is live-only arrives as a parameter, decided once in
 * `buildModules.ts`, so a Node test can hold both answers.
 */
import type { Arrangement } from '@gather/core/module-arrangement'
import { moduleById } from '@gather/core/modules'

const STORE_BUNDLE_ID = 'com.appelent.gather'

/** The bundle IDs `app.config.ts` gives development and preview builds. */
const WORK_IN_PROGRESS_BUNDLE_IDS: ReadonlySet<string> = new Set([
  `${STORE_BUNDLE_ID}.dev`,
  `${STORE_BUNDLE_ID}.preview`,
])

/**
 * True for the store build (`APP_VARIANT=production`), and for any build that
 * cannot say which it is: hiding a Module by mistake costs a tester a tap,
 * showing one by mistake costs an App Review.
 *
 * `override` is `EXPO_PUBLIC_LIVE_MODULES_ONLY`: `1` makes a development build
 * show what the store build shows, for store screenshots. It can only hide.
 */
export function showsOnlyLiveModules(
  bundleId: string | null | undefined,
  override?: string,
): boolean {
  if (override === '1') return true
  return !bundleId || !WORK_IN_PROGRESS_BUNDLE_IDS.has(bundleId)
}

export function isModuleShown(moduleId: string, liveOnly: boolean): boolean {
  const module = moduleById(moduleId)
  if (!module) return false
  return !liveOnly || module.status === 'live'
}

/**
 * Whether a screen in a Group-scoped stack (Home, All, Search) may draw.
 *
 * `routeName` is the route's file path below the tab: `notes/[noteId]`,
 * `tasks/task/[taskId]`, `index`. A first segment that names a Module belongs
 * to it; anything else (`index`, `[moduleId]`, `tasting/...`) is not a
 * Module's own route and is left alone. The tasting Modules sit under one
 * `tasting` segment and are all live; `[moduleId]` answers for itself in
 * `ModuleRoute`.
 */
export function isRouteShown(routeName: string, liveOnly: boolean): boolean {
  const segment = routeName.split('/')[0] ?? ''
  if (!moduleById(segment)) return true
  return isModuleShown(segment, liveOnly)
}

/** All's arrangement without the Modules this build does not show. */
export function shownArrangement(
  arrangement: Arrangement,
  liveOnly: boolean,
): Arrangement {
  if (!liveOnly) return arrangement
  const shown = (module: { id: string }) => isModuleShown(module.id, true)
  return {
    pinned: arrangement.pinned.filter(shown),
    groups: arrangement.groups
      .map(({ group, modules }) => ({ group, modules: modules.filter(shown) }))
      .filter(({ modules }) => modules.length > 0),
    hidden: arrangement.hidden.filter(shown),
  }
}
