/**
 * Which smart lists this phone hides from the Tasks index (APP-301).
 *
 * Kept on the device, like the All arrangement (ADR-0033): what a person
 * wants to see first is a property of how they use this phone, not of the
 * household. One key for every Group, because the smart lists are about the
 * person asking, and they are the same person in each.
 *
 * Best effort in both directions, like the rest of `localPreference.ts`: an
 * unreadable value is "nothing hidden", which is what a fresh install shows.
 */
import {
  parseHiddenSmartLists,
  type SmartListId,
  toggledSmartLists,
} from '@gather/core/smart-lists'
import { useCallback, useSyncExternalStore } from 'react'

import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from './localPreference'

/**
 * One copy for the whole app: the Tasks index and the Tasks settings page
 * (APP-611) are both mounted while the page is open, and the index must
 * already agree when Back returns to it.
 */
let cached: readonly SmartListId[] | null = null
const listeners = new Set<() => void>()

function snapshot(): readonly SmartListId[] {
  cached ??= parseHiddenSmartLists(
    readPreference(PREFERENCE_KEYS.hiddenSmartLists),
  )
  return cached
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHiddenSmartLists() {
  const hidden = useSyncExternalStore(subscribe, snapshot)
  const toggle = useCallback((id: SmartListId) => {
    cached = toggledSmartLists(snapshot(), id)
    writePreference(PREFERENCE_KEYS.hiddenSmartLists, JSON.stringify(cached))
    for (const listener of listeners) listener()
  }, [])
  return { hidden, toggle }
}
