import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import type { CalendarEditorProps } from './CalendarEditorCard'
import { CalendarEditorCard } from './CalendarEditorCard'

export function CalendarEditorSheet(props: CalendarEditorProps) {
  const { t } = useI18n()
  return (
    <NativeSheet
      title={
        props.draft.mode === 'edit' ? t.calendar.edit : t.calendar.newEvent
      }
      onClose={props.onClose}
      fill
    >
      <CalendarEditorCard
        {...props}
        overlay={false}
        full
        onCollapse={props.onCollapse}
        onExpand={undefined}
      />
    </NativeSheet>
  )
}
