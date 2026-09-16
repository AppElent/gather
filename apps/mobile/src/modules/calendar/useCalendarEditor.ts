import type { CalendarEvent } from '@gather/core/calendar'
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

const initialState: CalendarDraftState = {
  draft: null,
  presentation: 'card',
  storageError: null,
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
  create: (payload: ReturnType<typeof draftPayload>) => Promise<string>
  update: (
    id: string,
    revision: number,
    payload: ReturnType<typeof draftPayload>,
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
      dispatch({ type: 'storageError', error: 'draftCouldNotRestore' })
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
      if (blocker === 'calendar:offline')
        dispatch({ type: 'saveFailure', error: blocker })
      return false
    }
    submitting.current = true
    dispatch({ type: 'saveStart' })
    try {
      const payload = draftPayload(draft)
      if (draft.mode === 'create') await create(payload)
      else if (draft.eventId)
        await update(draft.eventId, draft.baseRevision, payload)
      else throw new Error('missing-event')
      clearCalendarDraft(userId, groupId)
      if (mounted.current) {
        dispatch({ type: 'saveSuccess' })
        haptics.itemSaved()
      }
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'save'
      const code = message.includes('calendar:conflict')
        ? 'calendar:conflict'
        : message.includes('calendar:deleted')
          ? 'calendar:deleted'
          : message.includes('calendar:')
            ? message.slice(message.indexOf('calendar:'))
            : 'save'
      if (mounted.current) {
        dispatch({ type: 'saveFailure', error: code })
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
    collapse: () => act({ type: 'collapse' }),
    dismiss: () => act({ type: 'dismiss' }),
    discard: () => {
      if (state.draft) clearCalendarDraft(userId, groupId)
      act({ type: 'discard' })
    },
    resume: () => {
      if (state.draft) dispatch({ type: 'open', draft: state.draft })
    },
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
