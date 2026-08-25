import { useEffect } from 'react'
import { useGroup } from '../group/GroupProvider'
import {
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../prefs/localPreference'

const RECENTS_KEY = PREFERENCE_KEYS.recentRecords
const MAXIMUM_PER_GROUP = 10

export type SearchRecordType =
  | 'recipe'
  | 'task'
  | 'note'
  | 'tasting'
  | 'calendarEvent'

export type RecentRecord = {
  groupSlug: string
  id: string
  type: SearchRecordType
  title: string
  detail: string
  openedAt: number
}

export type RecentRecordInput = Omit<RecentRecord, 'groupSlug' | 'openedAt'>

export function recordsForGroup(records: RecentRecord[], groupSlug: string) {
  return records
    .filter((record) => record.groupSlug === groupSlug)
    .sort((a, b) => b.openedAt - a.openedAt)
}

export function addRecentRecord(
  records: RecentRecord[],
  groupSlug: string,
  record: RecentRecordInput,
  openedAt = Date.now(),
) {
  const withoutRecord = records.filter(
    (entry) => !(entry.groupSlug === groupSlug && entry.id === record.id),
  )
  const otherGroups = withoutRecord.filter(
    (entry) => entry.groupSlug !== groupSlug,
  )
  const currentGroup = recordsForGroup(withoutRecord, groupSlug)
  return [{ ...record, groupSlug, openedAt }, ...currentGroup]
    .slice(0, MAXIMUM_PER_GROUP)
    .concat(otherGroups)
}

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

/** Records detail-page opens, including opens that did not start in Search. */
export function useRecordRecent(record: RecentRecordInput | null) {
  const { group } = useGroup()
  useEffect(() => {
    if (record) saveRecentRecord(group.slug, record)
  }, [group.slug, record])
}

function isRecentRecord(value: unknown): value is RecentRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<RecentRecord>
  return (
    typeof record.groupSlug === 'string' &&
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.detail === 'string' &&
    typeof record.openedAt === 'number' &&
    (record.type === 'recipe' ||
      record.type === 'task' ||
      record.type === 'note' ||
      record.type === 'tasting' ||
      record.type === 'calendarEvent')
  )
}
