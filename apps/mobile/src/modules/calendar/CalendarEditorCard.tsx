import type {
  CalendarColor,
  CalendarFieldErrors,
  CalendarPerson,
} from '@gather/core/calendar'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import type { CalendarDraft } from './calendarDraft'

export interface CalendarEditorProps {
  draft: CalendarDraft
  people: CalendarPerson[]
  calendars: { id: string; name: string; color?: CalendarColor }[]
  errors: CalendarFieldErrors
  onChange: (
    field: keyof CalendarDraft['values'],
    value: string | boolean | number | null | string[],
  ) => void
  onSave: () => void
  onClose: () => void
  onExpand?: () => void
  onCollapse?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onCreateCalendar?: () => void
  saving?: boolean
  overlay?: boolean
  full?: boolean
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  const tokens = useTokens('home')
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[styles.error, { color: tokens.danger }]}>{error}</Text>
      ) : null}
    </View>
  )
}

export function CalendarEditorCard({
  draft,
  people,
  calendars,
  errors,
  onChange,
  onSave,
  onClose,
  onExpand,
  onCollapse,
  onDuplicate,
  onDelete,
  onCreateCalendar,
  saving,
  overlay = true,
  full = false,
}: CalendarEditorProps) {
  const { t } = useI18n()
  const tokens = useTokens('home')
  const errorText = (key?: string) =>
    key
      ? t.calendar.validation[key as keyof typeof t.calendar.validation]
      : undefined
  const draftError =
    draft.error === 'calendar:conflict'
      ? t.calendar.errors.conflict
      : draft.error === 'calendar:deleted'
        ? t.calendar.errors.deleted
        : draft.error === 'storage'
          ? t.calendar.errors.storage
          : draft.error === 'calendar:offline'
            ? t.calendar.errors.offline
            : draft.error?.startsWith('calendar:')
              ? (t.calendar.validation[
                  draft.error.slice(
                    'calendar:'.length,
                  ) as keyof typeof t.calendar.validation
                ] ?? draft.error)
              : draft.error === 'save'
                ? t.calendar.errors.save
                : draft.error
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={overlay ? styles.overlay : undefined}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
        testID="calendar-editor-card"
      >
        <View style={styles.heading}>
          <Text style={[styles.headingText, { color: tokens.fg }]}>
            {draft.mode === 'edit' ? t.calendar.edit : t.calendar.newEvent}
          </Text>
          <Pressable onPress={onClose} accessibilityLabel={t.calendar.close}>
            <Text style={[styles.close, { color: tokens.muted }]}>x</Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          <Field label={t.calendar.title} error={errorText(errors.title)}>
            <TextInput
              testID="calendar-title"
              autoFocus={draft.mode === 'create'}
              value={draft.values.title}
              onChangeText={(value) => onChange('title', value)}
              placeholder={t.calendar.titlePlaceholder}
              placeholderTextColor={tokens.muted}
              style={[
                styles.input,
                { color: tokens.fg, borderColor: tokens.border },
              ]}
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
          </Field>
          <Field label={t.calendar.date} error={errorText(errors.date)}>
            <TextInput
              value={draft.values.date}
              onChangeText={(value) => onChange('date', value)}
              style={[
                styles.input,
                { color: tokens.fg, borderColor: tokens.border },
              ]}
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: tokens.muted }]}>
              {t.calendar.allDay}
            </Text>
            <Switch
              value={draft.values.allDay}
              onValueChange={(value) => onChange('allDay', value)}
            />
          </View>
          {!draft.values.allDay ? (
            <Field label={t.calendar.time} error={errorText(errors.time)}>
              <View style={styles.timeRow}>
                <TextInput
                  accessibilityLabel={t.calendar.startTime}
                  value={
                    draft.values.startMinutes == null
                      ? ''
                      : String(draft.values.startMinutes)
                  }
                  onChangeText={(value) =>
                    onChange('startMinutes', value ? Number(value) : null)
                  }
                  placeholder={t.calendar.startTime}
                  placeholderTextColor={tokens.muted}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    styles.timeInput,
                    { color: tokens.fg, borderColor: tokens.border },
                  ]}
                />
                <Text style={{ color: tokens.muted }}>-</Text>
                <TextInput
                  accessibilityLabel={t.calendar.endTime}
                  value={
                    draft.values.endMinutes == null
                      ? ''
                      : String(draft.values.endMinutes)
                  }
                  onChangeText={(value) =>
                    onChange('endMinutes', value ? Number(value) : null)
                  }
                  placeholder={t.calendar.endTime}
                  placeholderTextColor={tokens.muted}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    styles.timeInput,
                    { color: tokens.fg, borderColor: tokens.border },
                  ]}
                />
              </View>
            </Field>
          ) : null}
          <Field label={t.calendar.who} error={errorText(errors.assigneeIds)}>
            <View style={styles.chips}>
              {people.map((person) => {
                const selected = draft.values.assigneeIds.includes(person.id)
                const next = selected
                  ? draft.values.assigneeIds.filter((id) => id !== person.id)
                  : [...draft.values.assigneeIds, person.id]
                return (
                  <Pressable
                    key={person.id}
                    onPress={() => onChange('assigneeIds', next)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? tokens.accent : tokens.border,
                        backgroundColor: selected
                          ? tokens.tintOf('home').bg
                          : tokens.surface,
                      },
                    ]}
                  >
                    <Text style={{ color: tokens.fg }}>{person.name}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Text style={[styles.helper, { color: tokens.muted }]}>
              {draft.values.assigneeIds.length === 0
                ? t.calendar.unassigned
                : ''}
            </Text>
          </Field>
          <Field
            label={t.calendar.calendar}
            error={errorText(errors.calendarId)}
          >
            <View style={styles.chips}>
              {calendars.map((calendar) => (
                <Pressable
                  key={calendar.id}
                  onPress={() => onChange('calendarId', calendar.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor:
                        calendar.id === draft.values.calendarId
                          ? tokens.accent
                          : tokens.border,
                    },
                  ]}
                >
                  <Text style={{ color: tokens.fg }}>{calendar.name}</Text>
                </Pressable>
              ))}
            </View>
            {calendars.length === 0 && onCreateCalendar ? (
              <Pressable
                testID="calendar-add-calendar"
                onPress={onCreateCalendar}
                style={styles.addCalendar}
              >
                <Text style={{ color: tokens.accent }}>
                  {t.calendar.addCalendar}
                </Text>
              </Pressable>
            ) : null}
          </Field>
          {full ? (
            <>
              <Field
                label={t.calendar.location}
                error={errorText(errors.location)}
              >
                <TextInput
                  value={draft.values.location ?? ''}
                  onChangeText={(value) => onChange('location', value)}
                  placeholder={t.calendar.locationPlaceholder}
                  placeholderTextColor={tokens.muted}
                  style={[
                    styles.input,
                    { color: tokens.fg, borderColor: tokens.border },
                  ]}
                />
              </Field>
              <Field label={t.calendar.notes} error={errorText(errors.notes)}>
                <TextInput
                  multiline
                  value={draft.values.notes ?? ''}
                  onChangeText={(value) => onChange('notes', value)}
                  placeholder={t.calendar.notesPlaceholder}
                  placeholderTextColor={tokens.muted}
                  style={[
                    styles.input,
                    styles.notes,
                    { color: tokens.fg, borderColor: tokens.border },
                  ]}
                />
              </Field>
            </>
          ) : null}
          {onExpand || onCollapse ? (
            <Pressable
              testID={onCollapse ? 'calendar-collapse' : 'calendar-expand'}
              onPress={onCollapse ?? onExpand}
              style={styles.more}
            >
              <Text style={{ color: tokens.accent }}>
                {onCollapse ? t.calendar.collapse : t.calendar.expand}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {draftError ? (
          <Text style={[styles.error, { color: tokens.danger }]}>
            {draftError}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.footerButton}>
            <Text style={{ color: tokens.muted }}>{t.calendar.close}</Text>
          </Pressable>
          <Pressable
            testID="calendar-save"
            disabled={saving}
            onPress={onSave}
            style={[styles.save, { backgroundColor: tokens.accent }]}
          >
            <Text style={{ color: tokens.onAccent }}>
              {saving ? '...' : '✓'} {t.calendar.save}
            </Text>
          </Pressable>
        </View>
        {draft.mode === 'edit' ? (
          <View style={styles.secondary}>
            <Pressable onPress={onDuplicate}>
              <Text style={{ color: tokens.accent }}>
                {t.calendar.duplicate}
              </Text>
            </Pressable>
            <Pressable onPress={onDelete}>
              <Text style={{ color: tokens.danger }}>
                {t.calendar.deleteEvent}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    backgroundColor: '#00000030',
    zIndex: 10,
  },
  card: {
    maxHeight: '88%',
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingText: { fontSize: 20, fontWeight: '700' },
  close: { fontSize: 28 },
  body: { gap: 12, paddingVertical: 12 },
  field: { gap: 5 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  error: { fontSize: 12 },
  switchRow: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  helper: { fontSize: 12 },
  more: { paddingVertical: 8 },
  addCalendar: { minHeight: 44, justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  footerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  save: {
    minHeight: 44,
    borderRadius: RADIUS.control,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
})
