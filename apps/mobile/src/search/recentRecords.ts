/**
 * What Search remembers, and the rules for remembering it.
 *
 * This half is pure on purpose: the storage it is written to lives in
 * `recentRecordsStore.ts`, so these functions — and the guard in particular —
 * are callable from a Node test with no `expo-sqlite` in sight.
 */
import { isTastingKind, type TastingKind } from '@gather/core/tastings'

export const MAXIMUM_PER_GROUP = 10

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
  /**
   * Display text, in the reader's language — a recipe's tags, an event's time.
   * It is never routed on: that is what put a translated "Kaas" into a `kind`
   * route param and landed the tap on the Tasting index instead of the cheese.
   */
  detail: string
  /** A tasting's Kind, as the route spells it. Absent for every other type. */
  kind?: TastingKind
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

/**
 * Also the migration. Records written before a tasting carried its own `kind`
 * hold a translated label in `detail` and nothing routable, so they fail here
 * and are dropped on the next read rather than surviving as rows that cannot
 * be opened.
 */
export function isRecentRecord(value: unknown): value is RecentRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<RecentRecord>
  if (
    typeof record.groupSlug !== 'string' ||
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.detail !== 'string' ||
    typeof record.openedAt !== 'number'
  )
    return false
  switch (record.type) {
    case 'tasting':
      return isTastingKind(record.kind)
    case 'recipe':
    case 'task':
    case 'note':
    case 'calendarEvent':
      return true
    default:
      return false
  }
}

/**
 * Everything this Group remembered, gone. Other Groups' records are untouched:
 * one stored blob holds them all, so "clear" has to mean this Group's rows
 * rather than the key.
 */
export function clearGroupRecords(records: RecentRecord[], groupSlug: string) {
  return records.filter((record) => record.groupSlug !== groupSlug)
}
