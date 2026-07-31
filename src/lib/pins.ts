/**
 * Pins: the Modules one person keeps in their own navigation, in their own
 * order (CONTEXT.md).
 *
 * The backend stores opaque strings and knows nothing about the Module
 * catalog. Everything that turns those strings into Modules — the default for
 * someone who has never chosen, dropping an id no Module declares, editing the
 * order — happens here, in one place, with no React and no Convex in sight.
 * That is deliberate: this is where the behaviour the navigation depends on is
 * cheap to state and cheap to test.
 */

import type { ModuleDef } from './modules'
import { moduleById } from './modules'

/**
 * What a person sees before they have pinned anything.
 *
 * The live Modules other than the Baby log: pinning a placeholder would put a
 * dead end in someone's navigation on their first visit, and the Baby log is
 * only ever wanted by the households that have a baby — it stays one click
 * away under All, like everything else. Nobody has to configure this, which is
 * the point of it existing in code rather than as a Group setting.
 */
export const DEFAULT_PINS: readonly string[] = ['recipes', 'tasks', 'nutrition']

/**
 * The stored list reduced to ids that mean something, in order.
 *
 * `undefined` — nobody has chosen yet — becomes the default. An empty array is
 * a choice and stays empty. An id no Module declares is dropped rather than
 * carried, so a Pin left behind by a Module that no longer exists cannot break
 * the navigation that renders it. Duplicates collapse to their first position.
 */
export function pinnedModuleIds(stored?: readonly string[]): string[] {
  const source = stored ?? DEFAULT_PINS
  const out: string[] = []
  for (const id of source) {
    if (out.includes(id)) continue
    if (!moduleById(id)) continue
    out.push(id)
  }
  return out
}

/** The same list as the Modules themselves, ready to render. */
export function pinnedModules(stored?: readonly string[]): ModuleDef[] {
  return pinnedModuleIds(stored).flatMap((id) => {
    const module = moduleById(id)
    return module ? [module] : []
  })
}

/** Whether a Module is currently pinned. */
export function isPinned(stored: readonly string[] | undefined, id: string) {
  return pinnedModuleIds(stored).includes(id)
}

/**
 * The list with a Module pinned if it was not, and unpinned if it was.
 *
 * Takes and returns the id list rather than the stored value, so the caller
 * decides once — with `pinnedModuleIds` — what it is editing, and a first edit
 * by someone who has never chosen starts from the default they can see rather
 * than from nothing.
 */
export function togglePin(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

/**
 * The list with one Module moved a single place up or down. Moving the first
 * up, the last down, or something that is not in the list at all is a no-op —
 * a disabled button and a button that does nothing should not be different
 * outcomes here.
 */
export function movePin(
  ids: readonly string[],
  id: string,
  direction: 'up' | 'down',
): string[] {
  const from = ids.indexOf(id)
  if (from === -1) return [...ids]
  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= ids.length) return [...ids]

  const out = [...ids]
  out[from] = out[to]
  out[to] = id
  return out
}
