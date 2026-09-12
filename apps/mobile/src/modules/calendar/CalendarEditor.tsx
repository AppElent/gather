import type { CalendarPerson } from '@gather/core/calendar'
import { Alert } from 'react-native'
import { useI18n } from '../../i18n'
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
}: {
  controller: CalendarEditorController
  people: CalendarPerson[]
  calendars: { id: string; name: string }[]
  onClose: () => void
}) {
  const { t } = useI18n()
  const draft = controller.draft
  if (!draft) return null
  const errors = validateDraft(draft)
  const shared = {
    draft,
    people,
    calendars,
    errors,
    onChange: controller.changeField,
    onSave: () => void controller.save(),
    onClose: () => {
      controller.dismiss()
      onClose()
    },
    onExpand: controller.expand,
    onDuplicate: controller.duplicate,
    onDelete: () =>
      Alert.alert(
        t.calendar.confirmDelete.replace('{title}', draft.values.title),
        undefined,
        [
          { text: t.actions.cancel },
          {
            text: t.calendar.deleteEvent,
            style: 'destructive',
            onPress: () => void controller.delete(),
          },
        ],
      ),
    saving: draft.status === 'saving',
  }
  return controller.presentation === 'sheet' ? (
    <CalendarEditorSheet {...shared} />
  ) : (
    <CalendarEditorCard {...shared} />
  )
}
