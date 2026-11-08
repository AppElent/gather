/**
 * Tasks, level three: one task, with every field it has.
 *
 * Two rules from the canvas, both visible in what is *missing*:
 *
 * - **No Save button.** Every property is edited in its own sheet, which writes
 *   on selection and closes; the title and the notes write as they are typed.
 *   Back is done. A Save button on a screen where everything has already saved
 *   is a button that lies about what leaving without pressing it would do.
 * - **Every property is a row.** This is what makes the row's hold menu
 *   optional rather than load-bearing: everything the menu offers is also here,
 *   spelled out, in the order somebody would look for it.
 *
 * Delete is at the bottom, in red, and asks first — deleting in Gather is
 * permanent today (`apps/mobile/DESIGN_SYSTEM.md`).
 */
import { Stack, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { useDebouncedText } from '../../ui/use-debounced-text'
import { Checkbox, Chip, priorityColor } from './components'
import { TASK_ICONS } from './icons'
import { useTaskActions, useTaskState } from './store'
import { dueLabel, isOverdue } from './taskDates'
import { useTaskSheets } from './taskMenu'

export function TaskDetail({ taskId }: { taskId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const state = useTaskState()
  const actions = useTaskActions()
  const taskSheets = useTaskSheets({ onDeleted: () => router.back() })

  const task = state.tasks.find((each) => each.id === taskId)
  const list = state.lists.find((each) => each.id === task?.listId)

  useRecordRecent(
    task
      ? {
          id: task.id,
          type: 'task',
          title: task.title,
          detail: [list?.name, task.dueDate].filter(Boolean).join(' · '),
        }
      : null,
  )

  // Both fields write on a pause, not on a keystroke — see `useDebouncedText`.
  const title = useDebouncedText(task?.title ?? '', (next) => {
    if (task) actions.renameTask(task.id, next)
  })
  const notes = useDebouncedText(task?.notes ?? '', (next) => {
    if (task) actions.setNotes(task.id, next)
  })

  if (!task) return <View style={{ flex: 1, backgroundColor: tokens.bg }} />

  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate, state.today))
  const open = (action: string) => taskSheets.onAction(task, action)

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: list?.name ?? t.tasks.title }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        keyboardShouldPersistTaps="handled"
        // The notes field is the last thing on a long screen, so an open
        // keyboard covers Delete and everything below it. iOS insets the
        // scroll view for the keyboard (Android's `adjustResize` already
        // does), and dragging the list puts the keyboard away — the only
        // dismissal either platform offers a multiline field, where Return
        // means a new line rather than done.
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.head}>
          <Pressable
            testID="detail-toggle"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            accessibilityLabel={task.title}
            hitSlop={12}
            onPress={() => open('complete')}
            style={styles.headBox}
          >
            <Checkbox checked={task.done} />
          </Pressable>
          <TextInput
            testID="detail-title"
            value={title.draft}
            onChangeText={title.change}
            onBlur={title.flush}
            placeholder={t.tasks.task.titlePlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.tasks.task.titlePlaceholder}
            style={[
              styles.title,
              {
                color: task.done ? tokens.muted : tokens.fg,
                textDecorationLine: task.done ? 'line-through' : 'none',
              },
            ]}
          />
        </View>

        <Card>
          <PropertyRow
            testID="detail-due"
            icon={
              <TASK_ICONS.Calendar
                size={18}
                color={overdue ? tokens.danger : tokens.muted}
                strokeWidth={2}
              />
            }
            label={t.tasks.task.due}
            value={
              task.dueDate
                ? dueLabel(task.dueDate, state.today, locale, {
                    today: t.tasks.task.today,
                    tomorrow: t.tasks.task.tomorrow,
                  })
                : t.tasks.task.unset
            }
            danger={overdue}
            onPress={() => open('due')}
          />
          <PropertyRow
            testID="detail-priority"
            icon={
              <TASK_ICONS.Flag
                size={18}
                color={
                  priorityColor(task.priority, tokens.danger) ?? tokens.muted
                }
                strokeWidth={2}
              />
            }
            label={t.tasks.task.priority}
            value={
              task.priority
                ? t.tasks.task.priorities[task.priority]
                : t.tasks.task.unset
            }
            onPress={() => open('priority')}
          />
          <PropertyRow
            testID="detail-labels"
            icon={
              <TASK_ICONS.Tag size={18} color={tokens.muted} strokeWidth={2} />
            }
            label={t.tasks.task.labels}
            value={task.labels.length === 0 ? t.tasks.task.unset : undefined}
            trailing={
              task.labels.length > 0 ? (
                <View style={styles.chips}>
                  {task.labels.slice(0, 2).map((label) => (
                    <Chip key={label} label={label} />
                  ))}
                  {task.labels.length > 2 ? (
                    <Text style={[styles.more, { color: tokens.muted }]}>
                      +{task.labels.length - 2}
                    </Text>
                  ) : null}
                </View>
              ) : undefined
            }
            onPress={() => open('labels')}
          />
          <PropertyRow
            testID="detail-list"
            icon={
              list && list.provider !== 'local' ? (
                <TASK_ICONS.Link
                  size={18}
                  color={tokens.muted}
                  strokeWidth={2}
                />
              ) : (
                <TASK_ICONS.FileText
                  size={18}
                  color={tokens.muted}
                  strokeWidth={2}
                />
              )
            }
            label={t.tasks.task.list}
            value={list?.name ?? ''}
            onPress={() => open('move')}
            last
          />
        </Card>

        <Card>
          <TextInput
            testID="detail-notes"
            value={notes.draft}
            onChangeText={notes.change}
            onBlur={notes.flush}
            placeholder={t.tasks.task.notesPlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={t.tasks.task.notes}
            style={[styles.notes, { color: tokens.fg }]}
          />
        </Card>

        <Text style={[styles.hint, { color: tokens.muted }]}>
          {t.tasks.task.autosaved}
        </Text>

        <Pressable
          testID="detail-delete"
          accessibilityRole="button"
          accessibilityLabel={t.tasks.task.delete}
          onPress={() => open('delete')}
          style={({ pressed }) => [
            styles.delete,
            { borderColor: tokens.border, backgroundColor: tokens.surface },
            pressed && { backgroundColor: tokens.tile },
          ]}
        >
          <TASK_ICONS.Trash2
            size={17}
            color={tokens.danger}
            strokeWidth={2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.deleteText, { color: tokens.danger }]}>
            {t.tasks.task.delete}
          </Text>
        </Pressable>
      </ScrollView>

      {taskSheets.sheets}
    </>
  )
}

function PropertyRow({
  testID,
  icon,
  label,
  value,
  trailing,
  danger = false,
  last = false,
  onPress,
}: {
  testID: string
  icon: ReactNode
  label: string
  value?: string
  trailing?: ReactNode
  danger?: boolean
  last?: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const ChevronRight = UI_ICONS.ChevronRight

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      onPress={onPress}
      android_ripple={{ color: tokens.tile }}
      style={({ pressed }) => [
        styles.property,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.border,
        },
        pressed && { backgroundColor: tokens.tile },
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no">
        {icon}
      </View>
      <Text style={[styles.propertyLabel, { color: tokens.fg }]}>{label}</Text>
      {trailing ??
        (value ? (
          <Text
            numberOfLines={1}
            style={[
              styles.propertyValue,
              { color: danger ? tokens.danger : tokens.muted },
            ]}
          >
            {value}
          </Text>
        ) : null)}
      <ChevronRight
        size={18}
        color={tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 2,
  },
  headBox: { paddingTop: 5 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 29,
    padding: 0,
  },
  property: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 52,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  propertyLabel: { flex: 1, fontSize: 16 },
  propertyValue: { fontSize: 15, maxWidth: 170 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { fontSize: 12.5, fontWeight: '700' },
  notes: {
    fontSize: 15.5,
    lineHeight: 22,
    minHeight: 96,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  deleteText: { fontSize: 15.5, fontWeight: '600' },
})
