import {
  parseHiddenSmartLists,
  type SmartListId,
  toggledSmartLists,
} from '@gather/core/smart-lists'
import { useSyncExternalStore } from 'react'

/**
 * Which smart lists this browser hides from the Tasks index: the phone's
 * preference (`apps/mobile/src/prefs/hiddenSmartLists.ts`), with the same key
 * and value, and kept on the device as it is there (ADR-0033). One choice for
 * every Group.
 */
const KEY = 'gather:tasks:hidden-smart-lists'
const NONE: readonly SmartListId[] = []

// One copy for the page and the index, so both agree without a reload.
let cached: readonly SmartListId[] | null = null
const listeners = new Set<() => void>()

function snapshot(): readonly SmartListId[] {
  if (cached === null) {
    try {
      cached = parseHiddenSmartLists(window.localStorage.getItem(KEY))
    } catch {
      cached = NONE
    }
  }
  return cached
}

function onStorage(event: StorageEvent) {
  // A null key is another tab clearing everything.
  if (event.key !== KEY && event.key !== null) return
  cached = null
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    // Nobody was listening for other tabs' writes, so read afresh.
    cached = null
    window.addEventListener('storage', onStorage)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function toggle(id: SmartListId) {
  cached = toggledSmartLists(snapshot(), id)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    // Storage may be full or blocked; the choice holds until the page closes.
  }
  for (const listener of listeners) listener()
}

export function useHiddenSmartLists() {
  const hidden = useSyncExternalStore(subscribe, snapshot, () => NONE)
  return { hidden, toggle }
}
