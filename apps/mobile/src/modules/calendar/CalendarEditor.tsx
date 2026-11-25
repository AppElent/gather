import type { CalendarPerson } from '@gather/core/calendar'
import { useEffect, useRef } from 'react'
import { openSheet } from '../../components/openSheets'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { fmt, useI18n } from '../../i18n'
import { CalendarEditorCard } from './CalendarEditorCard'
import { CalendarEditorSheet } from './CalendarEditorSheet'
import {
  type CalendarDraft,
  type CalendarDraftState,
  validateDraft,
} from './calendarDraft'

type CalendarEditorController = CalendarDraftState & {
  changeField: (
    field: keyof CalendarDraft['values'],
    value: string | boolean | number | null | string[],
  ) => void
  save: () => Promise<boolean>
  dismiss: () => void
  expand: () => void
  duplicate: () => void
  delete: () => Promise<void>
  presentation: 'card' | 'sheet'
}

export function CalendarEditor({
  controller,
  people,
  calendars,
  onClose,
  onCreateCalendar,
}: {
  controller: CalendarEditorController
  people: CalendarPerson[]
  calendars: { id: string; name: string }[]
  onClose: () => void
  onCreateCalendar?: () => void
}) {
  const { t } = useI18n()
  const draft = controller.draft
  const close = () => {
    controller.dismiss()
    onClose()
  }
  // The card is drawn in the screen, not above it, but a link, a notification
  // or a share that leaves the screen unmounts it and the last typing with it.
  // Registered, it closes first, the way its Close does, so its draft is kept
  // (APP-817). The sheet registers itself.
  const closeCard = useRef(close)
  closeCard.current = close
  const inCard = Boolean(draft) && controller.presentation === 'card'
  useEffect(() => {
    if (!inCard) return
    return openSheet(() => closeCard.current()).closed
  }, [inCard])
  if (!draft) return null
  const errors = validateDraft(draft)
  const shared = {
    draft,
    people,
    calendars,
    errors,
    onChange: controller.changeField,
    onSave: () => void controller.save(),
    onClose: close,
    onExpand: controller.expand,
    onDuplicate: controller.duplicate,
    onDelete: () =>
      confirmDestructive({
        title: fmt(t.calendar.confirmDelete, { title: draft.values.title }),
        confirm: t.calendar.deleteEvent,
        cancel: t.common.actions.cancel,
        onConfirm: () => void controller.delete(),
      }),
    saving: draft.status === 'saving',
    onCreateCalendar,
  }
  return controller.presentation === 'sheet' ? (
    <CalendarEditorSheet {...shared} />
  ) : (
    <CalendarEditorCard {...shared} />
  )
}
