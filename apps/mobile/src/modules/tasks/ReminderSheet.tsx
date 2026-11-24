/**
 * Reminder (APP-305): when to be told about this task.
 *
 * A due date alone sets no reminder (16 Sept); this sheet is how one is
 * chosen. With a due date, two shortcuts answer most taps — the morning of
 * the day, the evening before — and write at once, like the Due date sheet's.
 * Under them is iOS's own date-and-time wheel for any other moment, which
 * Save writes. The reminder goes to whoever sets it.
 *
 * The first reminder is also when Gather asks for notifications
 * (`usePushPermission`): the reminder is saved whatever the answer.
 */
import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { presetClock, type ReminderPreset } from '@gather/core/task-reminders'
import { deviceTimeZone } from '@gather/core/time-zones'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { NativeSheet } from '../../components/NativeSheet'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { usePushPermission } from '../../features/notifications/use-push-permission'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { useSheetDraft } from '../../ui/sheet-drafts'
import {
  availablePresets,
  clockOfDate,
  initialPick,
} from './reminder'
import { useTaskActions } from './store'
import type { Task } from './types'

/** The iOS picker takes an underscore identifier; the app's locale is a language. */
const PICKER_LOCALE = { en: 'en_GB', nl: 'nl_NL' } as const

export function ReminderSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.tasks.task.reminderSheet
  const actions = useTaskActions()
  const { ask } = usePushPermission()
  const me = useQuery(api.users.me, {})
  const [now] = useState(() => new Date())
  // A share keeps the picked moment, as a number (APP-622).
  const draft = useSheetDraft<{ picked: number }>(`tasks:reminder:${task.id}`)
  const [picked, setPicked] = useState(() =>
    draft.kept
      ? new Date(draft.kept.picked)
      : initialPick(task.reminder, task.dueDate, now),
  )
  draft.track({ picked: picked.getTime() })
  const presets = availablePresets(task.dueDate, now)
  const someoneElse = Boolean(
    task.reminder && me && task.reminder.userId !== me._id,
  )

  const save = (clock: Parameters<typeof actions.setReminder>[1]) => {
    haptics.selectionChanged()
    onClose()
    actions
      .setReminder(task.id, clock)
      .then(() => {
        if (clock) void ask('reminder')
      })
      .catch(() => {
        haptics.actionFailed()
        showAlert(words.failed)
      })
  }

  const savePicked = () => {
    if (picked.getTime() < Date.now() - 60_000) {
      showAlert(words.passed)
      return
    }
    save(clockOfDate(picked))
  }

  const presetLabel: Record<ReminderPreset, string> = {
    dueDay: words.dueDay,
    eveningBefore: words.eveningBefore,
  }

  return (
    <NativeSheet
      title={t.tasks.task.reminder}
      onClose={onClose}
      confirm={{
        label: t.common.actions.save,
        onPress: savePicked,
        group: 'home',
        testID: 'reminder-save',
      }}
    >
      {presets.length > 0 ? (
        <View style={styles.shortcuts}>
          {presets.map((preset) => (
            <Pressable
              key={preset}
              testID={`reminder-${preset}`}
              accessibilityRole="button"
              accessibilityLabel={presetLabel[preset]}
              onPress={() =>
                task.dueDate &&
                save(presetClock(preset, task.dueDate, deviceTimeZone()))
              }
              style={({ pressed }) => [
                styles.shortcut,
                { borderColor: tokens.hair, backgroundColor: tokens.surface },
                pressed && { backgroundColor: tokens.surface2 },
              ]}
            >
              <Text style={[styles.shortcutText, { color: tokens.ink }]}>
                {presetLabel[preset]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.picker}>
        <DateTimePicker
          testID="reminder-picker"
          value={picked}
          mode="datetime"
          display="spinner"
          minimumDate={now}
          locale={PICKER_LOCALE[locale]}
          accentColor={tokens.ink}
          onValueChange={(_, next) => setPicked(next)}
        />
      </View>

      <Text style={[styles.footnote, { color: tokens.muted }]}>
        {someoneElse ? words.someoneElse : words.footnote}
      </Text>

      {task.reminder ? (
        <Pressable
          testID="reminder-remove"
          accessibilityRole="button"
          accessibilityLabel={words.remove}
          onPress={() => save(null)}
          hitSlop={8}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
        >
          <Text style={[styles.removeText, { color: tokens.danger }]}>
            {words.remove}
          </Text>
        </Pressable>
      ) : null}
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
  },
  shortcutText: { ...TYPE.bodyStrong },
  // Stretched, not centred: the wheel's Host takes its width from here and
  // collapses to nothing (drawn, but deaf to touches) under `alignItems:
  // 'center'` (expo/expo#46904).
  picker: { alignSelf: 'stretch', marginTop: 8 },
  footnote: { ...TYPE.footnote, marginTop: 4 },
  remove: { alignSelf: 'flex-start', paddingVertical: 12 },
  removeText: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
