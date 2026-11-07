import type { CalendarEvent } from '@gather/core/calendar'
import { readCalendarRefusal } from '@gather/core/refusals'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { haptics } from '../../feedback/haptics'
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
export type CalendarSavePayload = ReturnType<typeof draftPayload> & {
  calendarId: string
}

const initialState: CalendarDraftState = {
  draft: null,
  presentation: 'card',
}

export function useCalendarEditor({
  userId,
  groupId,
  connected,
  create,
  update,
  remove,
}: {
  userId: string
  groupId: string
  connected: boolean
  create: (payload: CalendarSavePayload) => Promise<string>
  update: (
    id: string,
    revision: number,
    payload: CalendarSavePayload,
  ) => Promise<{ revision: number }>
  remove: (id: string) => Promise<void>
}) {
  const [state, dispatch] = useReducer(reduceCalendarDraft, initialState)
  const mounted = useRef(true)
  const submitting = useRef(false)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  useEffect(() => {
    try {
      const restored = readCalendarDraft(userId, groupId)
      if (restored) dispatch({ type: 'open', draft: restored })
    } catch {
      // A stored draft that cannot be read is no draft.
    }
  }, [groupId, userId])
  useEffect(() => {
    if (
      !state.draft ||
      !['editing', 'saving', 'conflict', 'error', 'dismissed'].includes(
        state.draft.status,
      )
    )
      return
    if (state.draft.status === 'editing' && !isDraftDirty(state.draft)) return
    const timer = setTimeout(() => {
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
      else await create(payload)
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
    resume: () => dispatch({ type: 'resume' }),
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
