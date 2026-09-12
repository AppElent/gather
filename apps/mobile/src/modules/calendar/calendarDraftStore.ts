import Storage from 'expo-sqlite/kv-store'
import {
  type CalendarDraft,
  restoreCalendarDraft,
  serializeCalendarDraft,
} from './calendarDraft'

export function calendarDraftKey(userId: string, groupId: string) {
  return `gather:calendar:draft:${userId}:${groupId}`
}

export function readCalendarDraft(
  userId: string,
  groupId: string,
): CalendarDraft | null {
  const raw = Storage.getItemSync(calendarDraftKey(userId, groupId))
  if (!raw) return null
  return restoreCalendarDraft(raw, userId, groupId)
}

export function writeCalendarDraft(draft: CalendarDraft) {
  Storage.setItemSync(
    calendarDraftKey(draft.userId, draft.groupId),
    serializeCalendarDraft(draft),
  )
}

export function clearCalendarDraft(userId: string, groupId: string) {
  Storage.removeItemSync(calendarDraftKey(userId, groupId))
}
