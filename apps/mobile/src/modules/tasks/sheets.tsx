/**
 * One sheet per property a task has.
 *
 * They live together because the same five are reached from two places — the
 * row's hold menu on the list, and the rows of the detail screen — and a
 * property that can be edited in two places must be edited by one component or
 * the two will drift.
 *
 * All of them are `NativeSheet`, which is `@expo/ui`'s real bottom sheet:
 * presentation, drag, detents, keyboard and dismissal are the platform's
 * (`apps/mobile/DESIGN_SYSTEM.md`). None of them has a Save button — a sheet that
 * writes on selection and closes is one tap, and the sheet closing *is* the
 * confirmation.
 */
import {
  addDays,
  addMonths,
  localMidnight,
  monthGrid,
  monthStart,
  todayIn,
} from '@gather/core/civil-date'
import { possibleParents } from '@gather/core/linked-tasks'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { MonthGridView, WeekdayStrip } from '../../components/MonthGridView'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { radioProps } from '../../ui/radio-props'
import { useSheetDraft } from '../../ui/sheet-drafts'
import { Chip, priorityColor } from './components'
import { labelsWords } from './detailWords'
import { TASK_ICONS } from './icons'
import { useGroupLabels, useTaskActions, useTaskLists } from './store'
import { weekendFrom } from './taskDates'
import { type Priority, SUGGESTED_LABELS, type Task } from './types'
import { useWriteFailed } from './writeFailed'

const PRIORITIES: Priority[] = [1, 2, 3, 4]

/**
 * Due date: shortcuts, then a month.
 *
 * The shortcuts are on top because they answer most of the taps — today,
 * tomorrow, the weekend — and the grid is underneath because the ones they do
 * not answer are exactly the ones where a person wants to *see* the month.
 * This is the sheet the canvas argued about: a stepper is fine for a time you
 * already know and useless for "the Tuesday after the bank holiday".
 */
export function DueDateSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const actions = useTaskActions()
  const writeFailed = useWriteFailed()
  const { group } = useGroup()
  const today = todayIn(group.timeZone)
  const [month, setMonth] = useState(() => monthStart(task.dueDate ?? today))

  const grid = monthGrid(month)
  const selected = task.dueDate

  const pick = (iso: string | undefined) => {
    actions.setDue(task, iso).catch(writeFailed)
    haptics.selectionChanged()
    onClose()
  }

  const shortcuts: { id: string; label: string; iso: string | undefined }[] = [
    { id: 'today', label: t.tasks.task.today, iso: today },
    { id: 'tomorrow', label: t.tasks.task.tomorrow, iso: addDays(today, 1) },
    { id: 'weekend', label: t.tasks.task.weekend, iso: weekendFrom(today) },
    { id: 'none', label: t.tasks.task.clear, iso: undefined },
  ]

  return (
    <NativeSheet title={t.tasks.task.due} onClose={onClose}>
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
              { borderColor: tokens.hair, backgroundColor: tokens.surface },
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            <Text style={[styles.shortcutText, { color: tokens.ink }]}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.monthBar}>
        <Pressable
          testID="due-previous-month"
          accessibilityRole="button"
          accessibilityLabel={t.tasks.task.previousMonth}
          hitSlop={12}
          onPress={() => setMonth(addMonths(month, -1))}
        >
          <UI_ICONS.ChevronLeft
            size={20}
            color={tokens.ink}
            strokeWidth={2.2}
          />
        </Pressable>
        <Text style={[styles.monthName, { color: tokens.ink }]}>
          {localMidnight(month).toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          testID="due-next-month"
          accessibilityRole="button"
          accessibilityLabel={t.tasks.task.nextMonth}
          hitSlop={12}
          onPress={() => setMonth(addMonths(month, 1))}
        >
          <UI_ICONS.ChevronRight
            size={20}
            color={tokens.ink}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>

      <WeekdayStrip locale={locale} />

      <MonthGridView
        grid={grid}
        locale={locale}
        selected={selected}
        today={today}
        onPick={pick}
        testIDPrefix="due-day"
      />
    </NativeSheet>
  )
}

export function PrioritySheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const actions = useTaskActions()
  const writeFailed = useWriteFailed()
  const current = task.priority

  const choose = (priority: Priority | undefined) => {
    actions.setPriority(task, priority).catch(writeFailed)
    haptics.selectionChanged()
    onClose()
  }

  return (
    <NativeSheet title={t.tasks.task.priority} onClose={onClose}>
      {PRIORITIES.map((priority) => (
        <Pressable
          key={priority}
          testID={`priority-${priority}`}
          {...radioProps(priority === current, t.a11y.radioButton)}
          accessibilityLabel={t.tasks.task.priorities[priority]}
          onPress={() => choose(priority)}
          style={({ pressed }) => [
            styles.optionRow,
            { borderBottomColor: tokens.hair },
            pressed && { backgroundColor: tokens.surface2 },
          ]}
        >
          <TASK_ICONS.Flag
            size={17}
            color={priorityColor(priority, tokens) ?? tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.optionText, { color: tokens.ink }]}>
            {t.tasks.task.priorities[priority]}
          </Text>
          {priority === current ? (
            <UI_ICONS.Check size={18} color={tokens.ink} strokeWidth={2.6} />
          ) : null}
        </Pressable>
      ))}
      <Pressable
        testID="priority-none"
        {...radioProps(current === undefined, t.a11y.radioButton)}
        accessibilityLabel={t.tasks.task.unset}
        onPress={() => choose(undefined)}
        style={({ pressed }) => [
          styles.optionRow,
          styles.lastOption,
          pressed && { backgroundColor: tokens.surface2 },
        ]}
      >
        <Text style={[styles.optionText, { color: tokens.muted }]}>
          {t.tasks.task.unset}
        </Text>
      </Pressable>
    </NativeSheet>
  )
}

/**
 * Labels: the ones on the task, the ones the Group already uses, and a field,
 * with no label table behind them.
 *
 * This one keeps its sheet open — labels are a set rather than a choice, and
 * closing after the first would make adding two an exercise in reopening.
 *
 * A label exists because a task carries the word. Nothing creates one and
 * nothing has to delete one: the last task to let go of `hous` is what makes
 * it stop existing, so a typo cleans itself up instead of sitting in a
 * vocabulary forever waiting to be tidied.
 *
 * That leaves two jobs this sheet has to do that a picker would not. Taking a
 * label off *this* task is the cross on the chip. Fixing a word everywhere it
 * was typed is the hold menu on a suggestion — a rename that lands on a word
 * already in use is a merge, and the store's Set is what makes those the same
 * operation.
 */
export function LabelsSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  // Every word anybody in the Group has typed, from one labels query rather
  // than every list's rows (APP-565). Mounted only while the sheet is open.
  const typed = useGroupLabels()
  const actions = useTaskActions()
  const writeFailed = useWriteFailed()
  // A grocery item is an item, not a task (APP-557): the sheet asks the lists
  // which kind its task is on.
  const lists = useTaskLists()
  const words = labelsWords(
    t,
    lists?.find((list) => list._id === task.listId)?.grocery === true,
  )
  // A share keeps the word being typed, and which label it renames (APP-622).
  const kept = useSheetDraft<{ draft: string; renaming: string | null }>(
    `tasks:labels:${task.id}`,
  )
  const [draft, setDraft] = useState(kept.kept?.draft ?? '')
  /** The label being renamed, if the field is doing that instead of adding. */
  const [renaming, setRenaming] = useState<string | null>(
    kept.kept?.renaming ?? null,
  )
  kept.track({ draft, renaming })

  const labels = task.labels
  // Everything anybody has typed, minus what is already on this task, with a
  // few starters for a Group that has typed nothing yet.
  const elsewhere = Array.from(
    new Set([
      ...typed,
      ...SUGGESTED_LABELS,
    ]),
  )
    .filter((label) => !labels.includes(label))
    .sort()

  const setOwn = (next: string[]) => {
    // A linked list's labels change once its provider took the last change,
    // and each change sends them all: one at a time.
    if (task.pending) {
      haptics.actionFailed()
      return false
    }
    actions.setLabels(task, next).catch(writeFailed)
    return true
  }

  const submit = () => {
    const value = draft.trim().toLowerCase()
    if (!value) return
    if (task.pending && !renaming) {
      haptics.actionFailed()
      return
    }
    setDraft('')
    if (renaming) {
      actions.renameLabel(renaming, value)
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
    <NativeSheet title={t.tasks.task.labels} onClose={onClose}>
      <Text style={[styles.groupLabel, { color: tokens.muted }]}>
        {words.onThis}
      </Text>
      {labels.length === 0 ? (
        <Text style={[styles.groupEmpty, { color: tokens.muted }]}>
          {t.tasks.task.labelsNone}
        </Text>
      ) : (
        <View style={styles.chips}>
          {labels.map((label) => (
            <Chip
              key={label}
              label={label}
              on
              remove
              accessibilityLabel={fmt(t.tasks.task.removeLabel, { label })}
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
            {t.tasks.task.labelsInGroup}
          </Text>
          <View style={styles.chips}>
            {elsewhere.map((label) => (
              <NativeContextMenu
                key={label}
                actions={[
                  {
                    id: 'rename',
                    title: t.tasks.task.renameLabelEverywhere,
                    image: 'pencil',
                  },
                  {
                    id: 'remove',
                    title: words.removeEverywhere,
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ]}
                onAction={(id) => {
                  if (id === 'rename') startRename(label)
                  if (id === 'remove') actions.removeLabel(label)
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
          { borderColor: tokens.hair, backgroundColor: tokens.surface },
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
              ? fmt(t.tasks.task.renamingLabel, { label: renaming })
              : t.tasks.task.addLabel
          }
          placeholderTextColor={tokens.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={
            renaming
              ? fmt(t.tasks.task.renamingLabel, { label: renaming })
              : t.tasks.task.addLabel
          }
          style={[styles.fieldInput, { color: tokens.ink }]}
        />
      </View>
      {renaming ? (
        <Pressable
          testID="label-rename-cancel"
          accessibilityRole="button"
          accessibilityLabel={t.common.actions.cancel}
          onPress={cancelRename}
          style={styles.renameCancel}
        >
          <Text style={[styles.renameCancelText, { color: tokens.accentText }]}>
            {t.common.actions.cancel}
          </Text>
        </Pressable>
      ) : null}
    </NativeSheet>
  )
}

export function MoveToListSheet({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const lists = useTaskLists()
  const actions = useTaskActions()

  return (
    <NativeSheet title={t.tasks.list.moveToList} onClose={onClose}>
      {[...(lists ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((list, index, all) => {
          // A list Gather may not write to cannot be moved into: the write
          // would have to happen in Notion (ADR-0021).
          const disabled = !list.writable
          const radio = radioProps(
            list._id === task.listId,
            t.a11y.radioButton,
          )
          return (
            <Pressable
              key={list._id}
              testID={`move-${list._id}`}
              {...radio}
              accessibilityState={{
                ...radio.accessibilityState,
                disabled,
              }}
              accessibilityLabel={list.name}
              disabled={disabled}
              onPress={() => {
                onClose()
                actions.moveTask(task.id, list._id).then(
                  () => haptics.itemSaved(),
                  () => haptics.actionFailed(),
                )
              }}
              style={({ pressed }) => [
                styles.optionRow,
                index === all.length - 1 && styles.lastOption,
                { borderBottomColor: tokens.hair },
                disabled && styles.disabled,
                pressed && { backgroundColor: tokens.surface2 },
              ]}
            >
              <Text style={[styles.optionText, { color: tokens.ink }]}>
                {list.name}
              </Text>
              {disabled ? (
                <TASK_ICONS.Link
                  size={15}
                  color={tokens.muted}
                  strokeWidth={2.2}
                />
              ) : list._id === task.listId ? (
                <UI_ICONS.Check
                  size={18}
                  color={tokens.ink}
                  strokeWidth={2.6}
                />
              ) : null}
            </Pressable>
          )
        })}
    </NativeSheet>
  )
}

/**
 * A linked task under another one on its list, or back out (APP-448). One
 * level deep, as Gather draws subtasks.
 */
export function MoveUnderSheet({
  task,
  tasks,
  onClose,
}: {
  task: Task
  /** The screen's tasks; only the task's own list is offered. */
  tasks: readonly Task[]
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const actions = useTaskActions()
  const writeFailed = useWriteFailed()
  const parents = possibleParents(
    tasks
      .filter((each) => each.listId === task.listId)
      .map((each) => ({
        externalId: each.id,
        done: each.done,
        parentExternalId: each.parentTaskId,
        title: each.title,
      })),
    task.id,
  )
  const move = (parentId: string | null) => {
    onClose()
    if (parentId === (task.parentTaskId ?? null)) return
    actions.moveUnder(task, parentId).then(() => haptics.itemSaved(), writeFailed)
  }
  const options = [
    { id: null, title: t.tasks.linkedWrite.topLevel },
    ...parents.map(({ externalId, title }) => ({ id: externalId, title })),
  ]
  return (
    <NativeSheet title={t.tasks.linkedWrite.moveUnder} onClose={onClose}>
      {options.map(({ id, title }, index) => {
        const selected = id === (task.parentTaskId ?? null)
        return (
          <Pressable
            key={id ?? 'top'}
            testID={`under-${id ?? 'top'}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={title}
            onPress={() => move(id)}
            style={({ pressed }) => [
              styles.optionRow,
              index === options.length - 1 && styles.lastOption,
              { borderBottomColor: tokens.hair },
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: id === null ? tokens.muted : tokens.ink },
              ]}
            >
              {title}
            </Text>
            {selected ? (
              <UI_ICONS.Check size={18} color={tokens.ink} strokeWidth={2.6} />
            ) : null}
          </Pressable>
        )
      })}
      {parents.length === 0 ? (
        <Text style={[styles.groupEmpty, { color: tokens.muted }]}>
          {t.tasks.linkedWrite.noParents}
        </Text>
      ) : null}
    </NativeSheet>
  )
}

/** One field and a save, for renaming a task or a list. */
export function RenameSheet({
  title,
  value,
  place,
  onSave,
  onClose,
}: {
  title: string
  value: string
  /** Where a share keeps the unsaved name (APP-622): the task's or list's. */
  place: string
  onSave: (next: string) => void
  onClose: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const kept = useSheetDraft<{ draft: string }>(place)
  const [draft, setDraft] = useState(kept.kept?.draft ?? value)
  kept.track({ draft })
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
          accessibilityLabel={t.common.actions.save}
          disabled={!valid}
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: tokens.accent },
            !valid && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.saveText, { color: tokens.onAccent }]}>
            {t.common.actions.save}
          </Text>
        </Pressable>
      }
    >
      <View
        style={[
          styles.field,
          { borderColor: tokens.hair, backgroundColor: tokens.surface },
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
          style={[styles.fieldInput, { color: tokens.ink }]}
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
    borderRadius: RADIUS.pill,
  },
  shortcutText: { ...TYPE.bodyStrong },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 6,
  },
  monthName: { ...TYPE.bodyStrong },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastOption: { borderBottomWidth: 0 },
  optionText: { ...TYPE.body, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  groupLabel: {
    ...TYPE.footnoteStrong,
    marginBottom: 8,
  },
  groupEmpty: { ...TYPE.subhead, marginBottom: 14 },
  renameCancel: { alignSelf: 'flex-start', paddingVertical: 10 },
  renameCancelText: { ...TYPE.bodyStrong },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
  },
  fieldInput: { ...TYPE.body, flex: 1, paddingVertical: 10 },
  save: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  saveText: { ...TYPE.bodyStrong },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
})
