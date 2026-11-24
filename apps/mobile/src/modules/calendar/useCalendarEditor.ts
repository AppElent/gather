import type { CalendarEvent } from '@gather/core/calendar'
import { readCalendarRefusal } from '@gather/core/refusals'
import { useMutation } from 'convex/react'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useAvailability } from '../../availability/AvailabilityProvider'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import {
  type CalendarDraft,
  type CalendarDraftState,
  calendarSaveBlocker,
  createCalendarDraft,
  type DraftAction,
  draftPayload,
  editCalendarDraft,
  isDraftDirty,
  reduceCalendarDraft,
} from './calendarDraft'
import {
  clearCalendarDraft,
  readCalendarDraft,
  writeCalendarDraft,
} from './calendarDraftStore'

/** What a save sends: by then validation has insisted on a calendar. */
type CalendarSavePayload = ReturnType<typeof draftPayload> & {
  calendarId: string
}

/** Whether the draft is worth keeping on disk as it stands. */
function isKept(draft: CalendarDraft | null): draft is CalendarDraft {
  if (
    !draft ||
    !['editing', 'saving', 'conflict', 'error', 'dismissed'].includes(
      draft.status,
    )
  )
    return false
  return draft.status !== 'editing' || isDraftDirty(draft)
}

const initialState: CalendarDraftState = {
  draft: null,
  presentation: 'card',
}

/**
 * The event editor's draft, and the writes that settle it. Shared by the
 * calendar and the event screen, so the two cannot send an event differently.
 */
export function useCalendarEditor() {
  const { group } = useGroup()
  const groupId = group._id
  const me = useQuery(api.users.me)
  const userId = me?._id ?? ''
  const { serviceActionsEnabled } = useAvailability()
  const connected = serviceActionsEnabled && Boolean(me)
  const addEvent = useMutation(api.calendar.addCalendarEvent)
  const updateEvent = useMutation(api.calendar.updateEvent)
  const removeEvent = useMutation(api.calendar.removeCalendarEvent)

  const create = useCallback(
    (payload: CalendarSavePayload, draftId: string) =>
      addEvent({
        groupSlug: group.slug,
        calendarId: payload.calendarId as Id<'calendars'>,
        title: payload.title,
        date: payload.date,
        allDay: payload.allDay,
        startMinutes: payload.startMinutes ?? undefined,
        endMinutes: payload.endMinutes ?? undefined,
        assigneeIds: payload.assigneeIds as Id<'users'>[],
        location: payload.location ?? undefined,
        notes: payload.notes ?? undefined,
        // One event per draft, however often Save is pressed or retried.
        idempotencyKey: draftId,
      }),
    [addEvent, group.slug],
  )
  const update = useCallback(
    (id: string, revision: number, payload: CalendarSavePayload) =>
      updateEvent({
        groupSlug: group.slug,
        id: id as Id<'calendarEvents'>,
        expectedRevision: revision,
        title: payload.title,
        calendarId: payload.calendarId as Id<'calendars'>,
        date: payload.date,
        allDay: payload.allDay,
        startMinutes: payload.startMinutes,
        endMinutes: payload.endMinutes,
        assigneeIds: payload.assigneeIds as Id<'users'>[],
        location: payload.location,
        notes: payload.notes,
      }),
    [updateEvent, group.slug],
  )
  const remove = async (id: string) => {
    await removeEvent({ groupSlug: group.slug, id: id as Id<'calendarEvents'> })
  }

  const [state, dispatch] = useReducer(reduceCalendarDraft, initialState)
  const mounted = useRef(true)
  const submitting = useRef(false)
  const latest = useRef<CalendarDraft | null>(null)
  latest.current = state.draft
  // A change the timer below has not written yet. Only that is written when the
  // screen goes: a draft already on disk, one restored from it, or one saved or
  // discarded since must not be written again over what is there now.
  const unwritten = useRef(false)
  // The draft this screen read back from disk, which is on disk already.
  const restoredDraft = useRef<CalendarDraft | null>(null)
  useEffect(
    () => () => {
      mounted.current = false
      // The screen is going: what the timer below would write goes now, or
      // the last 250 ms of typing is lost (APP-817).
      try {
        if (unwritten.current && isKept(latest.current))
          writeCalendarDraft(latest.current)
      } catch {
        // Nothing left to tell.
      }
    },
    [],
  )
  useEffect(() => {
    try {
      const restored = readCalendarDraft(userId, groupId)
      if (restored) {
        // Stored mid-save: no save of this screen's will end it, so it must
        // not come back locked.
        const draft: CalendarDraft =
          restored.status === 'saving'
            ? { ...restored, status: 'editing' }
            : restored
        restoredDraft.current = draft
        dispatch({ type: 'open', draft })
      }
    } catch {
      // A stored draft that cannot be read is no draft.
    }
  }, [groupId, userId])
  useEffect(() => {
    if (!isKept(state.draft) || state.draft === restoredDraft.current) {
      unwritten.current = false
      return
    }
    unwritten.current = true
    const timer = setTimeout(() => {
      unwritten.current = false
      try {
        writeCalendarDraft(state.draft!)
      } catch {
        dispatch({ type: 'saveFailure', error: 'storage' })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [state.draft])

  const send = useCallback(async () => {
    const draft = state.draft
    if (!draft) return false
    const blocker = calendarSaveBlocker(draft, connected, submitting.current)
    if (blocker) {
      if (blocker === 'offline')
        dispatch({ type: 'saveFailure', error: blocker })
      return false
    }
    const { calendarId } = draft.values
    if (!calendarId || (draft.mode === 'edit' && !draft.eventId)) {
      dispatch({
        type: 'saveFailure',
        error: calendarId ? 'save' : 'calendarRequired',
      })
      haptics.actionFailed()
      return false
    }
    submitting.current = true
    dispatch({ type: 'saveStart' })
    try {
      const payload = { ...draftPayload(draft), calendarId }
      if (draft.mode === 'edit' && draft.eventId)
        await update(draft.eventId, draft.baseRevision, payload)
      else await create(payload, draft.draftId)
      clearCalendarDraft(userId, groupId)
      if (mounted.current) {
        dispatch({ type: 'saveSuccess' })
        haptics.itemSaved()
      }
      return true
    } catch (error) {
      if (mounted.current) {
        dispatch({
          type: 'saveFailure',
          error: readCalendarRefusal(error) ?? 'save',
        })
        haptics.actionFailed()
      }
      return false
    } finally {
      submitting.current = false
    }
  }, [connected, create, groupId, state.draft, update, userId])

  const act = useCallback((action: DraftAction) => dispatch(action), [])
  return {
    ...state,
    openNew: (date: string, calendarId: string | null) =>
      dispatch({
        type: 'open',
        draft: createCalendarDraft(userId, groupId, date, calendarId),
      }),
    /** A draft made elsewhere (the composer's All details), in the sheet. */
    openDraft: (draft: CalendarDraft) => {
      dispatch({ type: 'open', draft })
      dispatch({ type: 'expand' })
    },
    openEdit: (event: CalendarEvent) =>
      dispatch({
        type: 'open',
        draft: editCalendarDraft(userId, groupId, event),
      }),
    changeField: (
      field: keyof CalendarDraft['values'],
      value: string | boolean | number | null | string[],
    ) => act({ type: 'change', field, value }),
    expand: () => act({ type: 'expand' }),
    dismiss: () => act({ type: 'dismiss' }),
    discard: () => {
      if (state.draft) clearCalendarDraft(userId, groupId)
      act({ type: 'discard' })
    },
    // Closed while its save was on its way: back as saving, not editable, or
    // what was changed meanwhile would go when the save lands.
    resume: () =>
      dispatch({ type: submitting.current ? 'saveStart' : 'resume' }),
    save: send,
    duplicate: () =>
      act({ type: 'duplicate', draftId: `create:${Date.now()}` }),
    delete: async () => {
      if (state.draft?.mode === 'edit' && state.draft.eventId) {
        await remove(state.draft.eventId)
        clearCalendarDraft(userId, groupId)
        act({ type: 'discard' })
      }
    },
    deleteForEvent: async (id: string) => {
      await remove(id)
      if (state.draft?.eventId === id) {
        clearCalendarDraft(userId, groupId)
        act({ type: 'discard' })
      }
    },
  }
}
