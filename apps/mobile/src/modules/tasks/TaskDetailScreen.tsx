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
import { hasLinkAndPrice } from '@gather/core/task-lists'
import { describeRepeat } from '@gather/core/task-repeat'
import { Stack, useRouter } from 'expo-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
// Gesture Handler's own ScrollView: reordering subtasks drags inside it, and
// the drag has to name it to out-rank it (`ReorderMode.tsx`).
import { LegacyScrollView as ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { useRecordRecent } from '../../search/recentRecordsStore'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { useDebouncedText } from '../../ui/use-debounced-text'
import { AssigneeRow } from './assignee'
import { Checkbox, Chip, priorityColor } from './components'
import { detailWords } from './detailWords'
import { GroceryFields } from './GroceryFields'
import { TASK_ICONS } from './icons'
import { providerName } from './providerName'
import { reminderLabel } from './reminder'
import { SubtaskSection } from './SubtaskSection'
import { useTaskActions, useTaskOf } from './store'
import { dueLabel, isOverdue } from './taskDates'
import { useTaskSheets } from './taskMenu'
import { WishlistFields } from './WishlistFields'
import { useWriteFailed } from './writeFailed'

export function TaskDetail({ taskId }: { taskId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  // The task's own list only, never every list in the Group (APP-565).
  const state = useTaskOf(taskId)
  const actions = useTaskActions()
  const writeFailed = useWriteFailed()
  const taskSheets = useTaskSheets({
    tasks: state.tasks,
    // Deleting one of its subtasks from here leaves the parent's screen open.
    onDeleted: (gone) => {
      if (gone.id === taskId) router.back()
    },
  })
  const scrollRef = useRef<ScrollView>(null)
  const [dragging, setDragging] = useState(false)

  const task = state.task
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

  // Local fields write on a pause, not on a keystroke — see `useDebouncedText`.
  // A linked task's title saves on blur: each save is its provider's to take,
  // and a refused one puts the saved title back (APP-448).
  const title = useDebouncedText(
    task?.title ?? '',
    (next) => {
      if (!task) return
      if (!task.linked) {
        actions.renameTask(task, next)
        return
      }
      if (!next.trim()) {
        title.reset()
        return
      }
      if (next.trim() === task.title) return
      actions.renameTask(task, next).catch((error: unknown) => {
        title.reset()
        writeFailed(error)
      })
    },
    { onBlurOnly: Boolean(task?.linked) },
  )
  const notes = useDebouncedText(task?.notes ?? '', (next) => {
    if (task) actions.setNotes(task.id, next)
  })

  // Opening a task someone gave you is seeing it: the notice on Tasks goes.
  // The server clears it only for the assignee, so anyone else opening the
  // task changes nothing.
  const noticeId = task?.assignmentNotice ? task.id : null
  const markSeen = useRef(actions.markAssignmentSeen)
  markSeen.current = actions.markAssignmentSeen
  useEffect(() => {
    if (noticeId) markSeen.current(noticeId).catch(() => {})
  }, [noticeId])

  if (!task) return <View style={{ flex: 1, backgroundColor: tokens.ground }} />

  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate, state.today))
  const open = (action: string) => taskSheets.onAction(task, action)
  const repeatWords = t.tasks.repeat
  const words = detailWords(t, Boolean(list?.grocery))
  // A linked list's repeat is its provider's to set: shown in the provider's
  // words, with the row switched off (APP-303).
  // While the list loads, its task is the last one seen: a local one.
  const writable = list ? list.writable : !task.linked
  const canRepeat = Boolean(list?.writable && list.provider === 'local')
  // A subtask repeats with its parent, never on its own (APP-304).
  const subtask = Boolean(task.parentTaskId)
  const repeatValue = task.repeat
    ? describeRepeat(task.repeat, repeatWords.summary, locale)
    : (task.repeatText ?? repeatWords.summary.never)

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: list?.name ?? t.tasks.title }}
      />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
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
            accessibilityState={{ checked: task.done, disabled: !writable }}
            accessibilityLabel={task.title}
            disabled={!writable}
            hitSlop={12}
            onPress={() => open('complete')}
            style={styles.headBox}
          >
            <Checkbox checked={task.done} />
          </Pressable>
          <TextInput
            testID="detail-title"
            // Return saves a linked title; a line break has no place in one.
            submitBehavior={task.linked ? 'blurAndSubmit' : undefined}
            editable={writable}
            value={title.draft}
            onChangeText={title.change}
            onBlur={title.flush}
            placeholder={words.titlePlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            accessibilityLabel={words.titlePlaceholder}
            style={[
              styles.title,
              {
                color: task.done ? tokens.muted : tokens.ink,
                textDecorationLine: task.done ? 'line-through' : 'none',
              },
            ]}
          />
        </View>

        {list && hasLinkAndPrice(list.kind) ? (
          <WishlistFields task={task} writable={list.writable} />
        ) : null}
        {list?.grocery ? (
          <GroceryFields task={task} writable={list.writable} />
        ) : null}

        <Card>
          <AssigneeRow task={task} list={list} />
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
            disabled={!writable}
            onPress={() => open('due')}
          />
          {list?.provider === 'local' ? (
            <PropertyRow
              testID="detail-reminder"
              icon={
                <TASK_ICONS.Bell
                  size={18}
                  color={tokens.muted}
                  strokeWidth={2}
                />
              }
              label={t.tasks.task.reminder}
              value={
                task.reminder
                  ? reminderLabel(task.reminder, state.today, locale, {
                      today: t.tasks.task.today,
                      tomorrow: t.tasks.task.tomorrow,
                      reminderAt: t.tasks.task.reminderAt,
                    })
                  : t.tasks.task.unset
              }
              onPress={() => open('reminder')}
            />
          ) : null}
          <PropertyRow
            testID="detail-repeat"
            icon={
              <TASK_ICONS.Repeat
                size={18}
                color={tokens.muted}
                strokeWidth={2}
              />
            }
            label={repeatWords.title}
            value={repeatValue}
            disabled={!canRepeat || subtask}
            onPress={() => open('repeat')}
          />
          <PropertyRow
            testID="detail-priority"
            icon={
              <TASK_ICONS.Flag
                size={18}
                color={priorityColor(task.priority, tokens) ?? tokens.muted}
                strokeWidth={2}
              />
            }
            label={t.tasks.task.priority}
            value={
              task.priority
                ? t.tasks.task.priorities[task.priority]
                : t.tasks.task.unset
            }
            disabled={!writable}
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
            disabled={!writable}
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
            disabled={Boolean(task.linked)}
            onPress={() => open('move')}
            last={!task.linked}
          />
          {task.linked && list ? (
            <PropertyRow
              testID="detail-under"
              icon={
                <TASK_ICONS.CornerDownRight
                  size={18}
                  color={tokens.muted}
                  strokeWidth={2}
                />
              }
              label={t.tasks.linkedWrite.parentTask}
              value={
                state.tasks.find((each) => each.id === task.parentTaskId)?.title
              }
              disabled={!writable || task.done}
              onPress={() => open('under')}
              last
            />
          ) : null}
        </Card>
        {list && !canRepeat ? (
          <Text style={[styles.hint, { color: tokens.muted }]}>
            {fmt(repeatWords.linked, {
              provider: providerName(list.provider),
            })}
          </Text>
        ) : null}

        {list && !subtask && !list.grocery ? (
          <SubtaskSection
            task={task}
            list={list}
            tasks={state.tasks}
            today={state.today}
            scrollRef={scrollRef}
            onDragging={setDragging}
            onAction={taskSheets.onAction}
          />
        ) : null}

        {list?.provider === 'local' ? <CompletionHistory taskId={task.id} /> : null}

        {/* Notes are Gather's own; a linked task has nowhere to keep them. */}
        {task.linked ? null : (
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
            style={[styles.notes, { color: tokens.ink }]}
          />
        </Card>
        )}

        {writable ? (
          <Text style={[styles.hint, { color: tokens.muted }]}>
            {t.tasks.task.autosaved}
          </Text>
        ) : null}

        <Pressable
          testID="detail-delete"
          accessibilityRole="button"
          accessibilityLabel={words.delete}
          accessibilityState={{ disabled: !writable }}
          disabled={!writable}
          onPress={() => open('delete')}
          style={({ pressed }) => [
            styles.delete,
            { borderColor: tokens.hair, backgroundColor: tokens.surface },
            pressed && { backgroundColor: tokens.surface2 },
            !writable && styles.off,
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
            {words.delete}
          </Text>
        </Pressable>
      </ScrollView>

      {taskSheets.sheets}
    </>
  )
}

/**
 * Who completed a repeating task before, newest first (APP-303). Shown once
 * there is something in it; the newest one can be undone from the toast.
 */
function CompletionHistory({ taskId }: { taskId: string }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.tasks.repeat
  const rows = useQuery(api.tasks.completions, {
    taskId: taskId as Id<'tasks'>,
    groupSlug: group.slug,
  })
  if (!rows || rows.length === 0) return null
  return (
    <View testID="detail-history" style={styles.history}>
      <Text style={[styles.historyTitle, { color: tokens.muted }]}>
        {words.history}
      </Text>
      <Card>
        {rows.map((row, index) => (
          <View
            key={row._id}
            style={[
              styles.historyRow,
              index < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: tokens.hair,
              },
            ]}
          >
            <TASK_ICONS.CircleCheck
              size={16}
              color={tokens.muted}
              strokeWidth={2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.historyText, { color: tokens.ink }]}>
              {fmt(words.historyEntry, {
                name: row.byName ?? words.someone,
                when: new Date(row.completedAt).toLocaleDateString(locale, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }),
              })}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  )
}

function PropertyRow({
  testID,
  icon,
  label,
  value,
  trailing,
  danger = false,
  disabled = false,
  last = false,
  onPress,
}: {
  testID: string
  icon: ReactNode
  label: string
  value?: string
  trailing?: ReactNode
  danger?: boolean
  disabled?: boolean
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
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: tokens.surface2 }}
      style={({ pressed }) => [
        styles.property,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.hair,
        },
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no">
        {icon}
      </View>
      <Text style={[styles.propertyLabel, { color: tokens.ink }]}>{label}</Text>
      {trailing ??
        (value ? (
          <Text
            style={[
              styles.propertyValue,
              { color: danger ? tokens.danger : tokens.muted },
            ]}
          >
            {value}
          </Text>
        ) : null)}
      {disabled ? null : (
        <ChevronRight
          size={18}
        color={tokens.muted}
        strokeWidth={1.8}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
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
    ...TYPE.title2,
    flex: 1,
    letterSpacing: -0.4,
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
  propertyLabel: { ...TYPE.body, flex: 1 },
  propertyValue: {
    ...TYPE.subhead,
    maxWidth: 170,
    flexShrink: 1,
    textAlign: 'right',
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  more: { ...TYPE.footnoteStrong, ...TABULAR },
  notes: {
    ...TYPE.body,
    minHeight: 96,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  hint: { ...TYPE.footnote, paddingHorizontal: 4 },
  history: { gap: 6 },
  historyTitle: { ...TYPE.footnoteStrong, paddingHorizontal: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  historyText: { ...TYPE.subhead, flex: 1 },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.pill,
  },
  off: { opacity: 0.5 },
  deleteText: { ...TYPE.bodyStrong },
})
