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
import { isSmartListId, type SmartListId } from '@gather/core/smart-lists'
import { useCallback, useState } from 'react'

import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from './localPreference'

/** The stored value as smart list ids, dropping anything this build does not know. */
export function parseHiddenSmartLists(raw: string | null): SmartListId[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSmartListId) : []
  } catch {
    return []
  }
}

export function useHiddenSmartLists() {
  const [hidden, setHidden] = useState<readonly SmartListId[]>(() =>
    parseHiddenSmartLists(readPreference(PREFERENCE_KEYS.hiddenSmartLists)),
  )
  const toggle = useCallback((id: SmartListId) => {
    setHidden((current) => {
      const next = current.includes(id)
        ? current.filter((each) => each !== id)
        : [...current, id]
      writePreference(PREFERENCE_KEYS.hiddenSmartLists, JSON.stringify(next))
      return next
    })
  }, [])
  return { hidden, toggle }
}
