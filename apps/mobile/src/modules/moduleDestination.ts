/**
 * Where opening a Module from Home or All actually goes.
 *
 * Most Modules have no native workflow yet and land on `ModulePlaceholder` via
 * the dynamic `[moduleId]` route. The ones that are built have real screens at
 * a static segment — `/all/baby-log` — and a static route must be named
 * explicitly: navigating to `{pathname: '/all/[moduleId]', params: {moduleId:
 * 'baby-log'}}` targets the dynamic route, which would render the placeholder
 * over a Module that exists.
 *
 * One list, consulted by both tabs. **When a Module gets its native screens,
 * add it here** — the tab that opens it has no other way to find out, and the
 * failure is silent: a finished Module that still shows "planned".
 */
import type { ModuleId } from '@gather/core/modules'
import type { Href } from 'expo-router'

/** Modules with real screens in the phone's route tree. */
export const NATIVE_MODULES = [
  'baby-log',
  'tasks',
  'notes',
] as const satisfies readonly ModuleId[]

export type NativeModuleId = (typeof NATIVE_MODULES)[number]

export function isNativeModule(id: string): id is NativeModuleId {
  return (NATIVE_MODULES as readonly string[]).includes(id)
}

/**
 * The href for a Module inside the All stack.
 *
 * The cast is confined here for the reason `modules/baby/paths.ts` gives: typed
 * routes cannot check a template string, and one place assembling paths by hand
 * beats every call site doing it.
 */
export function moduleDestination(
  // A plain string rather than `ModuleId`: the callers hold a Module's own
  // `id`, which the catalogue types loosely at the call site, and narrowing
  // here would push a cast into both tabs to save one.
  moduleId: string,
): Href {
  if (isNativeModule(moduleId)) return `/all/${moduleId}` as Href
  return {
    pathname: '/all/[moduleId]',
    params: { moduleId },
  } as Href
}
