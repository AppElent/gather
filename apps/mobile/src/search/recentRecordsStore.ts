/**
 * Where recents are kept. The only file in `search/` that touches storage —
 * everything above it stays pure, and testable, in `recentRecords.ts`.
 */
import { useEffect } from 'react'

import { useGroup } from '../group/GroupProvider'
import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'
import {
  addRecentRecord,
  clearGroupRecords,
  isRecentRecord,
  type RecentRecordInput,
} from './recentRecords'

const RECENTS_KEY = PREFERENCE_KEYS.recentRecords

export function readRecentRecords() {
  const value = readPreference(RECENTS_KEY)
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter(isRecentRecord).slice(0, 100)
      : []
  } catch {
    return []
  }
}

export function saveRecentRecord(groupSlug: string, record: RecentRecordInput) {
  writePreference(
    RECENTS_KEY,
    JSON.stringify(addRecentRecord(readRecentRecords(), groupSlug, record)),
  )
}

/**
 * Forgets where this Group has been, and returns what is left so the caller
 * does not have to read the blob back.
 *
 * **No confirmation, unlike every other destructive action in the app.**
 * Recents are this phone's memory of its own navigation, not household
 * content — there is nothing here another Member can lose. Clearing the whole
 * `RECENTS_KEY` would be the bug: one key holds every Group's records, so that
 * would wipe a household nobody was looking at.
 */
export function clearRecentRecords(groupSlug: string) {
  const kept = clearGroupRecords(readRecentRecords(), groupSlug)
  writePreference(RECENTS_KEY, JSON.stringify(kept))
  return kept
}

/**
 * Records detail-page opens, including opens that did not start in Search.
 *
 * Every call site builds the record inline, so it is a new object on every
 * render. Depending on its identity would mean a synchronous read-modify-write
 * of the whole recents blob per render; depending on its *contents* means one
 * write per actual change.
 */
export function useRecordRecent(record: RecentRecordInput | null) {
  const { group } = useGroup()
  const serialized = record ? JSON.stringify(record) : null
  useEffect(() => {
    if (serialized)
      saveRecentRecord(group.slug, JSON.parse(serialized) as RecentRecordInput)
  }, [group.slug, serialized])
}
