/**
 * Where the All screen's arrangement is kept, and the only file that knows it
 * is kept on the phone at all.
 *
 * **Device-local, pins included (ADR-0033).** The web's Pins live on the
 * membership row and are reached through `users.myPins` / `users.setPins`;
 * these are a second, separate list that never leaves this handset. The two
 * are allowed to disagree, and the ADR is where that is written down rather
 * than being left for somebody to discover.
 *
 * Reads are synchronous because `expo-sqlite/kv-store` is, and because the
 * first frame has to be the right one - an awaited read is a visible frame of
 * the catalogue order before the reader's own arrangement replaces it.
 *
 * Everything here is best-effort in both directions, like the rest of
 * `localPreference.ts`: unreadable storage means a phone that forgot an
 * arrangement, which lands on the same defaults a fresh install has.
 */
import {
  type Arrangement,
  arrangeModules,
  flattenModuleOrder,
  type StoredArrangement,
  toggleHidden,
} from '@gather/core/module-arrangement'
import type { ModuleGroup } from '@gather/core/modules'
import { pinnedModuleIds, togglePin } from '@gather/core/pins'
import { useCallback, useMemo, useState } from 'react'

import {
  allArrangementKey,
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from './localPreference'

export type AllView = 'list' | 'grid'

/** The pseudo-section at the bottom, which collapses like a real one. */
export const HIDDEN_SECTION = 'hidden'

/**
 * Sections that start closed. Only one, and it is the reason `collapsed` is
 * stored the way it is below.
 */
const DEFAULT_COLLAPSED = new Set<string>([HIDDEN_SECTION])

interface StoredAll extends StoredArrangement {
  /**
   * `ModuleGroup` names plus `HIDDEN_SECTION` - but read it as a list of
   * *departures from the default*, not a list of closed sections. A category
   * in here is closed because categories open by default; Hidden in here is
   * **open**, because Hidden starts closed.
   *
   * One field instead of two, and it falls out of the same idea as
   * `arrangeModules`'s refusals: what is stored is what the reader changed,
   * so a section whose default flips one day flips for everybody who never
   * touched it and for nobody who did.
   */
  collapsed?: string[]
}

const stringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined

function readStored(groupSlug: string): StoredAll {
  const raw = readPreference(allArrangementKey(groupSlug))
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const record = parsed as Record<string, unknown>
    // Field by field rather than a cast: a blob written by an older build, or
    // hand-edited in a debugger, must degrade to "never chosen" per field
    // instead of throwing on the frame that draws the screen.
    return {
      pinned: stringArray(record.pinned),
      hidden: stringArray(record.hidden),
      order: stringArray(record.order),
      groupOrder: stringArray(record.groupOrder),
      collapsed: stringArray(record.collapsed),
    }
  } catch {
    return {}
  }
}

function writeStored(groupSlug: string, value: StoredAll) {
  writePreference(allArrangementKey(groupSlug), JSON.stringify(value))
}

export function readAllView(): AllView {
  return readPreference(PREFERENCE_KEYS.allView) === 'grid' ? 'grid' : 'list'
}

export function useAllView() {
  const [view, setView] = useState<AllView>(readAllView)
  return [
    view,
    useCallback((next: AllView) => {
      setView(next)
      writePreference(PREFERENCE_KEYS.allView, next)
    }, []),
  ] as const
}

export interface ModuleArrangement {
  arrangement: Arrangement
  isCollapsed: (section: string) => boolean
  isPinned: (id: string) => boolean
  togglePinned: (id: string) => void
  toggleHide: (id: string) => void
  toggleCollapsed: (section: string) => void
  setModuleOrder: (group: ModuleGroup, ids: readonly string[]) => void
  setGroupOrder: (groups: readonly ModuleGroup[]) => void
  setPinnedOrder: (ids: readonly string[]) => void
}

export function useModuleArrangement(groupSlug: string): ModuleArrangement {
  // Derived during render rather than in an effect: the All stack is keyed on
  // the Group slug so this normally remounts anyway, and an effect would cost
  // one frame of the previous household's arrangement if it ever did not.
  const [state, setState] = useState(() => ({
    slug: groupSlug,
    stored: readStored(groupSlug),
  }))
  if (state.slug !== groupSlug) {
    setState({ slug: groupSlug, stored: readStored(groupSlug) })
  }
  const stored = state.slug === groupSlug ? state.stored : readStored(groupSlug)

  const arrangement = useMemo(() => arrangeModules(stored), [stored])
  const collapsed = stored.collapsed ?? []

  const commit = useCallback(
    (next: StoredAll) => {
      setState({ slug: groupSlug, stored: next })
      writeStored(groupSlug, next)
    },
    [groupSlug],
  )

  const orderFor = useCallback(
    (group: ModuleGroup, ids: readonly string[]) =>
      flattenModuleOrder(
        arrangement.groups.map((entry) =>
          entry.group === group
            ? {
                group,
                modules: ids.flatMap((id) => {
                  const module = entry.modules.find((item) => item.id === id)
                  return module ? [module] : []
                }),
              }
            : entry,
        ),
      ),
    [arrangement.groups],
  )

  return {
    arrangement,
    isCollapsed: (section) =>
      collapsed.includes(section) !== DEFAULT_COLLAPSED.has(section),
    isPinned: (id) => arrangement.pinned.some((module) => module.id === id),
    togglePinned: (id) =>
      commit({
        ...stored,
        pinned: togglePin(pinnedModuleIds(stored.pinned), id),
      }),
    /**
     * The stored pin survives a hide, even though `arrangeModules` refuses to
     * show a hidden Module in Pinned. Dropping it here would make unhiding
     * quietly lose a choice the reader never revoked; keeping it means Show
     * puts the row back exactly where Hide found it.
     */
    toggleHide: (id) =>
      commit({ ...stored, hidden: toggleHidden(stored.hidden ?? [], id) }),
    toggleCollapsed: (section) =>
      commit({
        ...stored,
        collapsed: collapsed.includes(section)
          ? collapsed.filter((item) => item !== section)
          : [...collapsed, section],
      }),
    setModuleOrder: (group, ids) =>
      commit({ ...stored, order: orderFor(group, ids) }),
    setGroupOrder: (groups) => commit({ ...stored, groupOrder: [...groups] }),
    setPinnedOrder: (ids) => commit({ ...stored, pinned: [...ids] }),
  }
}
