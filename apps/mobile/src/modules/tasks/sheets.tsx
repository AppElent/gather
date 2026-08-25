/**
 * One sheet per property a task has.
 *
 * They live together because the same five are reached from two places â€” the
 * row's hold menu on the list, and the rows of the detail screen â€” and a
 * property that can be edited in two places must be edited by one component or
 * the two will drift.
 *
 * All of them are `NativeSheet`, which is `@expo/ui`'s real bottom sheet:
 * presentation, drag, detents, keyboard and dismissal are the platform's
 * (`docs/mobile-interaction.md`). None of them has a Save button â€” a sheet that
 * writes on selection and closes is one tap, and the sheet closing *is* the
 * confirmation.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Chip } from './components'
import { TASK_ICONS } from './icons'
import { taskActions, useTaskState } from './store'
import {
  addDays,
  monthGrid,
  monthOf,
  parseDay,
  shiftMonth,
  weekendFrom,
} from './taskDates'
import { type Priority, SUGGESTED_LABELS } from './types'

const PRIORITIES: Priority[] = [1, 2, 3, 4]

/** Red for the most urgent, amber for high, and nothing at all below that. */
export function priorityColor(
  priority: Priority | undefined,
  danger: string,
): string | undefined {
  if (priority === 1) return danger
  if (priority === 2) return '#b4791f'
  return undefined
}

/**
 * Due date: shortcuts, then a month.
 *
 * The shortcuts are on top because they answer most of the taps â€” today,
 * tomorrow, the weekend â€” and the grid is underneath because the ones they do
 * not answer are exactly the ones where a person wants to *see* the month.
 * This is the sheet the canvas argued about: a stepper is fine for a time you
 * already know and useless for "the Tuesday after the bank holiday".
 */
export function DueDateSheet({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t, locale } = useI18n()
  const state = useTaskState()
  const task = state.tasks.find((each) => each.id === taskId)
  const [month, setMonth] = useState(() =>
    monthOf(task?.dueDate ?? state.today),
  )

  const grid = monthGrid(month.year, month.month)
  const selected = task?.dueDate

  const pick = (iso: string | undefined) => {
    taskActions.setDue(taskId, iso)
    haptics.selectionChanged()
    onClose()
  }

  // A Monday, so the weekday strip starts where the grid does.
  const mondayNames = Array.from({ length: 7 }, (_, index) =>
    new Date(2024, 0, 1 + index).toLocaleDateString(locale, {
      weekday: 'narrow',
    }),
  )

  const shortcuts: { id: string; label: string; iso: string | undefined }[] = [
    { id: 'today', label: t.labs.task.today, iso: state.today },
    {
      id: 'tomorrow',
      label: t.labs.task.tomorrow,
      iso: addDays(state.today, 1),
    },
    {
      id: 'weekend',
      label: t.labs.task.weekend,
      iso: weekendFrom(state.today),
    },
    { id: 'none', label: t.labs.task.clear, iso: undefined },
  ]

  return (
    <NativeSheet title={t.labs.task.due} onClose={onClose}>
      <View style={styles.shortcuts}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.id}
            testID={`due-${shortcut.id}`}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
            onPress={() => pick(shortcut.iso)}
            style={({ pressed }) => [
              styles.shortcut,
              { borderColor: tokens.border, backgroundColor: tokens.surface },
              pressed && { backgroundColor: tokens.tile },
            ]}
          >
            <Text style={[styles.shortcutText, { color: tokens.fg }]}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.monthBar}>
        <Pressable
          testID="due-previous-month"
          accessibilityRole="button"
          accessibilityLabel={t.labs.task.previousMonth}
          hitSlop={12}
          onPress={() => setMonth(shiftMonth(month, -1))}
        >
          <UI_ICONS.ChevronLeft size={20} color={tokens.fg} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.monthName, { color: tokens.fg }]}>
          {grid.first.toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          testID="due-next-month"
          accessibilityRole="button"
          accessibilityLabel={t.labs.task.nextMonth}
          hitSlop={12}
          onPress={() => setMonth(shiftMonth(month, 1))}
        >
          <UI_ICONS.ChevronRight
            size={20}
            color={tokens.fg}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {mondayNames.map((name, index) => (
          <Text
            // Narrow weekday names repeat (T, T / S, S), so the index is the key.
            key={index}
            style={[styles.weekday, { color: tokens.muted }]}
          >
            {name.toUpperCase()}
          </Text>
        ))}
      </View>

      {grid.weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((iso, column) =>
            iso === null ? (
              <View key={column} style={styles.day} />
            ) : (
              <Pressable
                key={column}
                testID={`due-day-${iso}`}
                accessibilityRole="button"
                accessibilityState={{ selected: iso === selected }}
                accessibilityLabel={parseDay(iso).toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                onPress={() => pick(iso)}
                style={styles.day}
              >
                <View
                  style={[
                    styles.dayInner,
                    iso === selected && { backgroundColor: tint.fg },
                    iso === state.today &&
                      iso !== selected && {
                        borderWidth: 1.4,
                        borderColor: tint.fg,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color:
                          iso === selected
                            ? tokens.surface
                            : iso === state.today
                              ? tint.fg
                              : tokens.fg,
                        fontWeight:
                          iso === selected || iso === state.today
                            ? '700'
                            : '400',
                      },
                    ]}
                  >
                    {parseDay(iso).getDate()}
                  </Text>
                </View>
              </Pressable>
            ),
          )}
        </View>
      ))}
    </NativeSheet>
  )
}

export function PrioritySheet({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const state = useTaskState()
  const current = state.tasks.find((each) => each.id === taskId)?.priority

  const choose = (priority: Priority | undefined) => {
    taskActions.setPriority(taskId, priority)
    haptics.selectionChanged()
    onClose()
  }

  return (
    <NativeSheet title={t.labs.task.priority} onClose={onClose}>
      {PRIORITIES.map((priority) => (
        <Pressable
          key={priority}
          testID={`priority-${priority}`}
          accessibilityRole="button"
          accessibilityState={{ selected: priority === current }}
          accessibilityLabel={t.labs.task.priorities[priority]}
          onPress={() => choose(priority)}
          style={({ pressed }) => [
            styles.optionRow,
            { borderBottomColor: tokens.border },
            pressed && { backgroundColor: tokens.tile },
          ]}
        >
          <TASK_ICONS.Flag
            size={17}
            color={priorityColor(priority, tokens.danger) ?? tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.optionText, { color: tokens.fg }]}>
            {t.labs.task.priorities[priority]}
          </Text>
          {priority === current ? (
            <UI_ICONS.Check size={18} color={tokens.fg} strokeWidth={2.6} />
          ) : null}
        </Pressable>
      ))}
      <Pressable
        testID="priority-none"
        accessibilityRole="button"
        accessibilityLabel={t.labs.task.unset}
        onPress={() => choose(undefined)}
        style={({ pressed }) => [
          styles.optionRow,
          styles.lastOption,
          pressed && { backgroundColor: tokens.tile },
        ]}
      >
        <Text style={[styles.optionText, { color: tokens.muted }]}>
          {t.labs.task.unset}
        </Text>
      </Pressable>
    </NativeSheet>
  )
}

/**
 * Labels: the ones on the task, the ones the Group already uses, and a field.
 *
 * This one keeps its sheet open â€” labels are a set rather than a choice, and
 * closing after the first would make adding two an exercise in reopening.
 */
/**
 * Labels, with no label table behind them.
 *
 * A label exists because a task carries the word. Nothing creates one and
 * nothing has to delete one: the last task to let go of `hous` is what makes
 * it stop existing, so a typo cleans itself up instead of sitting in a
 * vocabulary forever waiting to be tidied.
 *
 * That leaves two jobs this sheet has to do that a picker would not. Taking a
 * label off *this* task is the cross on the chip. Fixing a word everywhere it
 * was typed is the hold menu on a suggestion â€” a rename that lands on a word
 * already in use is a merge, and the store's Set is what makes those the same
 * operation.
 */
export function LabelsSheet({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const state = useTaskState()
  const task = state.tasks.find((each) => each.id === taskId)
  const [draft, setDraft] = useState('')
  /** The label being renamed, if the field is doing that instead of adding. */
  const [renaming, setRenaming] = useState<string | null>(null)

  const labels = task?.labels ?? []
  // Everything anybody has typed, minus what is already on this task. The
  // fixtures' suggestions are seeded here rather than kept as a list, so they
  // behave like every other label: used or gone.
  const elsewhere = Array.from(
    new Set([
      ...state.tasks.flatMap((each) => each.labels),
      ...SUGGESTED_LABELS,
    ]),
  )
    .filter((label) => !labels.includes(label))
    .sort()

  const setOwn = (next: string[]) => taskActions.setLabels(taskId, next)

  const submit = () => {
    const value = draft.trim().toLowerCase()
    if (!value) return
    setDraft('')
    if (renaming) {
      taskActions.renameLabel(renaming, value)
      setRenaming(null)
      haptics.itemSaved()
      return
    }
    if (!labels.includes(value)) setOwn([...labels, value])
    haptics.itemSaved()
  }

  const startRename = (label: string) => {
    setRenaming(label)
    setDraft(label)
  }

  const cancelRename = () => {
    setRenaming(null)
    setDraft('')
  }

  return (
    <NativeSheet title={t.labs.task.labels} onClose={onClose}>
      <Text style={[styles.groupLabel, { color: tokens.muted }]}>
        {t.labs.task.labelsOnTask}
      </Text>
      {labels.length === 0 ? (
        <Text style={[styles.groupEmpty, { color: tokens.muted }]}>
          {t.labs.task.labelsNone}
        </Text>
      ) : (
        <View style={styles.chips}>
          {labels.map((label) => (
            <Chip
              key={label}
              label={label}
              on
              remove
              accessibilityLabel={fmt(t.labs.task.removeLabel, { label })}
              onPress={() => {
                haptics.selectionChanged()
                setOwn(labels.filter((each) => each !== label))
              }}
            />
          ))}
        </View>
      )}

      {elsewhere.length > 0 ? (
        <>
          <Text style={[styles.groupLabel, { color: tokens.muted }]}>
            {t.labs.task.labelsInGroup}
          </Text>
          <View style={styles.chips}>
            {elsewhere.map((label) => (
              <NativeContextMenu
                key={label}
                actions={[
                  {
                    id: 'rename',
                    title: t.labs.task.renameLabelEverywhere,
                    image: 'pencil',
                  },
                  {
                    id: 'remove',
                    title: t.labs.task.removeLabelEverywhere,
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ]}
                onAction={(id) => {
                  if (id === 'rename') startRename(label)
                  if (id === 'remove') taskActions.removeLabel(label)
                }}
              >
                <Chip
                  label={label}
                  onPress={() => {
                    haptics.selectionChanged()
                    setOwn([...labels, label])
                  }}
                />
              </NativeContextMenu>
            ))}
          </View>
        </>
      ) : null}

      <View
        style={[
          styles.field,
          { borderColor: tokens.border, backgroundColor: tokens.surface },
        ]}
      >
        <TASK_ICONS.Tag
          size={16}
          color={tokens.muted}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TextInput
          testID="label-field"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder={
            renaming
              ? fmt(t.labs.task.renamingLabel, { label: renaming })
              : t.labs.task.addLabel
          }
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={
            renaming
              ? fmt(t.labs.task.renamingLabel, { label: renaming })
              : t.labs.task.addLabel
          }
          style={[styles.fieldInput, { color: tokens.fg }]}
        />
      </View>
      {renaming ? (
        <Pressable
          testID="label-rename-cancel"
          accessibilityRole="button"
          accessibilityLabel={t.labs.task.renameLabelCancel}
          onPress={cancelRename}
          style={styles.renameCancel}
        >
          <Text style={[styles.renameCancelText, { color: tokens.accent }]}>
            {t.labs.task.renameLabelCancel}
          </Text>
        </Pressable>
      ) : null}
    </NativeSheet>
  )
}

export function MoveToListSheet({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const state = useTaskState()
  const task = state.tasks.find((each) => each.id === taskId)

  return (
    <NativeSheet title={t.labs.list.moveToList} onClose={onClose}>
      {[...state.lists]
        .sort((a, b) => a.order - b.order)
        .map((list, index, all) => {
          // A list Gather may not write to cannot be moved into: the write
          // would have to happen in Notion (ADR-0021).
          const disabled = !list.writable
          return (
            <Pressable
              key={list.id}
              testID={`move-${list.id}`}
              accessibilityRole="button"
              accessibilityState={{
                selected: list.id === task?.listId,
                disabled,
              }}
              accessibilityLabel={list.name}
              disabled={disabled}
              onPress={() => {
                taskActions.moveTask(taskId, list.id)
                haptics.itemSaved()
                onClose()
              }}
              style={({ pressed }) => [
                styles.optionRow,
                index === all.length - 1 && styles.lastOption,
                { borderBottomColor: tokens.border },
                disabled && styles.disabled,
                pressed && { backgroundColor: tokens.tile },
              ]}
            >
              <Text style={[styles.optionText, { color: tokens.fg }]}>
                {list.name}
              </Text>
              {disabled ? (
                <TASK_ICONS.Link
                  size={15}
                  color={tokens.muted}
                  strokeWidth={2.2}
                />
              ) : list.id === task?.listId ? (
                <UI_ICONS.Check size={18} color={tokens.fg} strokeWidth={2.6} />
              ) : null}
            </Pressable>
          )
        })}
    </NativeSheet>
  )
}

/** One field and a save, for renaming a task or a list. */
export function RenameSheet({
  title,
  value,
  onSave,
  onClose,
}: {
  title: string
  value: string
  onSave: (next: string) => void
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t } = useI18n()
  const [draft, setDraft] = useState(value)
  const valid = draft.trim().length > 0

  const save = () => {
    if (!valid) {
      haptics.actionFailed()
      return
    }
    onSave(draft.trim())
    haptics.itemSaved()
    onClose()
  }

  return (
    <NativeSheet
      title={title}
      onClose={onClose}
      footer={
        <Pressable
          testID="rename-save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid }}
          accessibilityLabel={t.actions.save}
          disabled={!valid}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: tint.fg },
            !valid && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.saveText, { color: tokens.surface }]}>
            {t.actions.save}
          </Text>
        </Pressable>
      }
    >
      <View
        style={[
          styles.field,
          { borderColor: tokens.border, backgroundColor: tokens.surface },
        ]}
      >
        <TextInput
          testID="rename-field"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={save}
          autoFocus
          returnKeyType="done"
          accessibilityLabel={title}
          style={[styles.fieldInput, { color: tokens.fg }]}
        />
      </View>
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
    borderRadius: RADIUS.control,
  },
  shortcutText: { fontSize: 14.5, fontWeight: '600' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 6,
  },
  monthName: { fontSize: 16, fontWeight: '700' },
  weekdays: { flexDirection: 'row', paddingBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  week: { flexDirection: 'row' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastOption: { borderBottomWidth: 0 },
  optionText: { flex: 1, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  groupEmpty: { fontSize: 14, marginBottom: 14 },
  renameCancel: { alignSelf: 'flex-start', paddingVertical: 10 },
  renameCancelText: { fontSize: 15, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  fieldInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  save: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.control,
  },
  saveText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
})
