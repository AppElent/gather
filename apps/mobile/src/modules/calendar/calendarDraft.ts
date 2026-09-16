import {
  type CalendarEvent,
  type CalendarFieldErrors,
  type CalendarFieldValues,
  hasCalendarErrors,
  normalizeCalendarEvent,
  validateCalendarFields,
} from '@gather/core/calendar'

export const CALENDAR_DRAFT_VERSION = 1

export type CalendarDraft = {
  version: typeof CALENDAR_DRAFT_VERSION
  draftId: string
  userId: string
  groupId: string
  mode: 'create' | 'edit'
  eventId: string | null
  baseRevision: number
  values: Required<CalendarFieldValues>
  original: Required<CalendarFieldValues> | null
  status: 'editing' | 'saving' | 'conflict' | 'error' | 'dismissed'
  error: string | null
}

export type DraftAction =
  | { type: 'open'; draft: CalendarDraft }
  | { type: 'storageError'; error: string }
  | {
      type: 'change'
      field: keyof CalendarDraft['values']
      value: string | boolean | number | null | string[]
    }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'dismiss' }
  | { type: 'saveStart' }
  | { type: 'saveFailure'; error: string }
  | { type: 'conflict'; error: 'conflict' | 'deleted' }
  | { type: 'saveSuccess' }
  | { type: 'reload'; event: CalendarEvent }
  | { type: 'duplicate'; draftId: string }
  | { type: 'discard' }

export interface CalendarDraftState {
  draft: CalendarDraft | null
  presentation: 'card' | 'sheet'
  storageError: string | null
}

export function emptyDraftValues(
  date: string,
  calendarId: string | null,
): Required<CalendarFieldValues> {
  return {
    calendarId,
    title: '',
    date,
    allDay: true,
    startMinutes: null,
    endMinutes: null,
    assigneeIds: [],
    location: '',
    notes: '',
  }
}

function valuesFromEvent(event: CalendarEvent): Required<CalendarFieldValues> {
  return {
    calendarId: event.calendarId,
    title: event.title,
    date: event.date,
    allDay: event.allDay,
    startMinutes: event.startMinutes ?? null,
    endMinutes: event.endMinutes ?? null,
    assigneeIds: [...event.assigneeIds],
    location: event.location,
    notes: event.notes,
  }
}

export function createCalendarDraft(
  userId: string,
  groupId: string,
  date: string,
  calendarId: string | null,
): CalendarDraft {
  return {
    version: CALENDAR_DRAFT_VERSION,
    draftId: `create:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    userId,
    groupId,
    mode: 'create',
    eventId: null,
    baseRevision: 0,
    values: emptyDraftValues(date, calendarId),
    original: null,
    status: 'editing',
    error: null,
  }
}

export function editCalendarDraft(
  userId: string,
  groupId: string,
  event: CalendarEvent,
): CalendarDraft {
  const values = valuesFromEvent(event)
  return {
    version: CALENDAR_DRAFT_VERSION,
    draftId: `edit:${event.id}:${event.revision}`,
    userId,
    groupId,
    mode: 'edit',
    eventId: event.id,
    baseRevision: event.revision,
    values,
    original: values,
    status: 'editing',
    error: null,
  }
}

export function isDraftDirty(draft: CalendarDraft): boolean {
  if (!draft.original)
    return (
      draft.values.title.trim() !== '' ||
      JSON.stringify(draft.values) !==
        JSON.stringify(
          emptyDraftValues(draft.values.date, draft.values.calendarId),
        )
    )
  return JSON.stringify(draft.values) !== JSON.stringify(draft.original)
}

export function validateDraft(draft: CalendarDraft): CalendarFieldErrors {
  return validateCalendarFields(draft.values)
}

export function reduceCalendarDraft(
  state: CalendarDraftState,
  action: DraftAction,
): CalendarDraftState {
  if (action.type === 'open')
    return {
      ...state,
      draft: action.draft,
      presentation: 'card',
      storageError: null,
    }
  if (action.type === 'storageError')
    return { ...state, storageError: action.error }
  if (!state.draft && action.type !== 'discard') return state
  if (action.type === 'expand') return { ...state, presentation: 'sheet' }
  if (action.type === 'collapse') return { ...state, presentation: 'card' }
  if (action.type === 'discard')
    return { ...state, draft: null, storageError: null }
  const draft = state.draft!
  switch (action.type) {
    case 'change':
      return {
        ...state,
        draft: {
          ...draft,
          values: { ...draft.values, [action.field]: action.value },
          status: 'editing',
          error: null,
        },
      }
    case 'dismiss':
      return { ...state, draft: { ...draft, status: 'dismissed' } }
    case 'saveStart':
      return { ...state, draft: { ...draft, status: 'saving', error: null } }
    case 'saveFailure':
      return {
        ...state,
        draft: {
          ...draft,
          status:
            action.error === 'calendar:conflict'
              ? 'conflict'
              : action.error === 'calendar:deleted'
                ? 'conflict'
                : 'error',
          error: action.error,
        },
      }
    case 'conflict':
      return {
        ...state,
        draft: { ...draft, status: 'conflict', error: action.error },
      }
    case 'saveSuccess':
      return { ...state, draft: null, storageError: null }
    case 'reload': {
      const values = valuesFromEvent(action.event)
      return {
        ...state,
        draft: {
          ...draft,
          eventId: action.event.id,
          baseRevision: action.event.revision,
          values,
          original: values,
          status: 'editing',
          error: null,
        },
      }
    }
    case 'duplicate':
      return {
        ...state,
        draft: {
          ...draft,
          draftId: action.draftId,
          mode: 'create',
          eventId: null,
          baseRevision: 0,
          original: null,
          status: 'editing',
          error: null,
        },
      }
  }
}

export function serializeCalendarDraft(draft: CalendarDraft): string {
  return JSON.stringify(draft)
}

export function restoreCalendarDraft(
  raw: string,
  userId: string,
  groupId: string,
): CalendarDraft {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid-draft')
  const draft = parsed as Partial<CalendarDraft>
  if (
    draft.version !== CALENDAR_DRAFT_VERSION ||
    draft.userId !== userId ||
    draft.groupId !== groupId ||
    !draft.values ||
    !draft.draftId
  )
    throw new Error('unknown-draft-version')
  return draft as CalendarDraft
}

export function draftCanSave(
  draft: CalendarDraft,
  connected: boolean,
  submitting: boolean,
): boolean {
  return calendarSaveBlocker(draft, connected, submitting) === null
}

/** Keep a native button press from becoming a silent no-op. */
export function calendarSaveBlocker(
  draft: CalendarDraft,
  connected: boolean,
  submitting: boolean,
): string | null {
  if (submitting || draft.status === 'saving') return 'saving'
  if (!isDraftDirty(draft)) return 'unchanged'
  const errors = validateDraft(draft)
  if (hasCalendarErrors(errors)) {
    const firstError = Object.values(errors).find(Boolean)
    return firstError ? `calendar:${firstError}` : 'calendar:invalid'
  }
  if (!connected) return 'calendar:offline'
  return null
}

export function draftPayload(draft: CalendarDraft) {
  return {
    ...draft.values,
    calendarId: draft.values.calendarId,
    startMinutes: draft.values.allDay ? null : draft.values.startMinutes,
    endMinutes: draft.values.allDay ? null : draft.values.endMinutes,
    location: (draft.values.location ?? '').trim() || null,
    notes: (draft.values.notes ?? '').trim() || null,
  }
}

export { normalizeCalendarEvent }
