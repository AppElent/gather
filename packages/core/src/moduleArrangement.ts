/**
 * How one person has arranged the Modules they see.
 *
 * Pure: this file decides *what the arrangement is*, never where it is kept.
 * On the phone that is a device-local blob (ADR-0033); the web keeps its Pins
 * on the membership row (ADR-0005) and does not use this yet. Keeping the
 * reconciliation here rather than in a client is what stops the two answering
 * "where does a brand new Module appear" differently.
 *
 * **The governing rule is ADR-0022's: store refusals, not acceptances.**
 * `hidden` is a list of Modules a person has turned away, so a Module that
 * ships tomorrow is visible to everybody the day it lands — nobody has refused
 * something that did not exist. An `enabled` list would do the opposite and
 * every new Module would arrive invisible to every existing reader.
 *
 * `order` is stored the same way round: a *partial* list. Anything missing from
 * it is put back at its canonical position rather than swept to the bottom, so
 * a new kitchen Module appears among the kitchen Modules of somebody who
 * rearranged that section a year ago.
 */
import {
  MODULE_GROUPS,
  MODULES,
  type ModuleDef,
  type ModuleGroup,
  moduleById,
} from './modules'
import { pinnedModuleIds } from './pins'

/** What a client has written down. Every field is optional and validated here. */
export interface StoredArrangement {
  /** Ordered. `undefined` = never chosen; `[]` = chose to pin nothing. */
  pinned?: readonly string[]
  /** Refusals, unordered. */
  hidden?: readonly string[]
  /** Partial, flat across every group. */
  order?: readonly string[]
  /** Partial. */
  groupOrder?: readonly string[]
}

export interface ArrangedGroup {
  group: ModuleGroup
  modules: ModuleDef[]
}

export interface Arrangement {
  /** The shortcut section. Never contains a hidden Module. */
  pinned: ModuleDef[]
  /** Every group, in the reader's order, each holding its visible Modules. */
  groups: ArrangedGroup[]
  /** What was refused, in canonical order — the order it was refused in says nothing. */
  hidden: ModuleDef[]
}

/**
 * A stored partial order, reconciled against what actually exists.
 *
 * Three things happen here, and each of them is a rule somebody will otherwise
 * rediscover as a bug: ids that no longer name anything are dropped, ids named
 * twice are kept once, and anything the stored order never mentioned is put
 * back where the catalogue would have had it. That last one is why a new
 * Module lands *in its section* rather than at the end of it.
 *
 * The newcomer goes after the last **already-placed** row that canonically
 * precedes it, which is not the same thing as after its nearest canonical
 * neighbour. Anchoring on the neighbour looks equivalent and is not: given a
 * reader who deliberately moved Recipes below Nutrition, it wedges all three
 * unmentioned kitchen Modules between them and leaves Recipes at the bottom of
 * the section — undoing the one arrangement they actually made. Scanning for
 * the last placed predecessor instead can never move a row the reader placed.
 */
export function reconcileOrder<T extends string>(
  canonical: readonly T[],
  stored: readonly string[] | undefined,
): T[] {
  const known = new Set<string>(canonical)
  const result: T[] = []
  for (const id of stored ?? []) {
    if (known.has(id) && !result.includes(id as T)) result.push(id as T)
  }
  if (result.length === canonical.length) return result

  const rank = new Map(canonical.map((id, index) => [id as string, index]))
  for (let i = 0; i < canonical.length; i++) {
    const id = canonical[i]
    if (result.includes(id)) continue
    // The furthest-along row that belongs in front of this one. Front of the
    // list when nothing does.
    let at = 0
    for (let position = 0; position < result.length; position++) {
      if ((rank.get(result[position]) ?? -1) < i) at = position + 1
    }
    result.splice(at, 0, id)
  }
  return result
}

export function arrangeModules(stored: StoredArrangement = {}): Arrangement {
  const hiddenIds = new Set<string>()
  for (const id of stored.hidden ?? []) {
    if (moduleById(id)) hiddenIds.add(id)
  }

  // Hiding a Module unpins it: a shortcut to something deliberately out of
  // sight is a contradiction, and the alternative is a Pinned section holding
  // a row the reader cannot find anywhere else on the screen.
  const pinned = pinnedModuleIds(stored.pinned)
    .filter((id) => !hiddenIds.has(id))
    .flatMap((id) => {
      const module = moduleById(id)
      return module ? [module] : []
    })

  const groups = reconcileOrder(MODULE_GROUPS, stored.groupOrder).map(
    (group) => {
      const canonical = MODULES.filter((module) => module.group === group).map(
        (module) => module.id,
      )
      const modules = reconcileOrder(canonical, stored.order)
        .filter((id) => !hiddenIds.has(id))
        .flatMap((id) => {
          const module = moduleById(id)
          return module ? [module] : []
        })
      return { group, modules }
    },
  )

  const hidden: ModuleDef[] = MODULES.filter((module) =>
    hiddenIds.has(module.id),
  )

  return { pinned, groups, hidden }
}

export function toggleHidden(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id)
    ? hidden.filter((item) => item !== id)
    : [...hidden, id]
}

/**
 * The flat `order` to store, read back off an arrangement that has just been
 * rearranged.
 *
 * Hidden Modules are deliberately *not* carried through. They are absent from
 * `groups`, so they fall out of the stored order, and `reconcileOrder` puts
 * them back at their canonical position when they are unhidden. That is a
 * decision rather than an oversight: unhiding returns a Module to where the
 * catalogue says it belongs in its section, not to wherever it happened to sit
 * before it was hidden. Remembering the second one means keeping a position
 * for a row nobody can see, and nobody would be able to predict the result.
 */
export function flattenModuleOrder(groups: readonly ArrangedGroup[]): string[] {
  return groups.flatMap((entry) => entry.modules.map((module) => module.id))
}
