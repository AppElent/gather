/**
 * A task as a row, and the two things every list of rows ends with.
 *
 * One row for every place a task is drawn — a list, the Today strip, a
 * checklist inside another Module — so a tick, a swipe and a hold mean the same
 * thing wherever the task appears.
 */
import { type ReactNode, useRef } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { UI_ICONS } from '../../theme/icons'
import { SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { useInsetSeparator } from '../../ui/inset-list'
import { AssigneeCoin, useTaskPeople } from './assignee'
import { useCompleteTask } from './completeTask'
import { Checkbox } from './components'
import { LINKED_KINDS } from './composerDraft'
import { useFresh } from './freshTasks'
import { TASK_ICONS } from './icons'
import { QuickAddChips, QuickAddInput, useQuickAddLine } from './QuickAddParts'
import { LinkedWriteError, useTaskActions } from './store'
import { taskMenuActions } from './taskMenu'
import type { Task } from './types'
import { useWriteFailed } from './writeFailed'

/** The check ring's diameter (`components/InsetList`). */
const CHECK_RING = 24

/**
 * One task.
 *
 * With `onOpen`, three ways in: tap opens it, swipe right completes it, hold
 * opens the menu, and the box is its own target. The menu is never the only
 * way to anything — every item in it is also a row on the detail screen.
 * Without `onOpen`, the whole row is the box: a checklist line has nowhere
 * else to go, so it never truncates either.
 */
export function TaskRow({
  task,
  writable,
  onOpen,
  menu,
  bar,
  meta,
  trailing,
  label,
  chevron = false,
  onToggled,
}: {
  task: Task
  writable: boolean
  onOpen?: () => void
  /** The hold menu and both swipes. Reorder appears only inside a list. */
  menu?: {
    reorder: boolean
    /** Whether the list has sections, which adds Move to section (APP-357). */
    sections?: boolean
    onAction: (action: string) => void
  }
  /** The priority bar's colour; no bar at all when absent. */
  bar?: string
  /** What sits under the title. */
  meta?: ReactNode
  /** What sits at the row's end, before any chevron: a grocery amount. */
  trailing?: ReactNode
  /** What a screen reader says for the row, when more than the title. */
  label?: string
  chevron?: boolean
  /** Whether the server took the tick. */
  onToggled?: (ok: boolean) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const swipe = useRef<SwipeableMethods | null>(null)
  // Rows sit in an `InsetList`: the hairline starts at the text column.
  const separator = useInsetSeparator()
  // The responsible Member's coin, trailing (APP-302); VoiceOver hears it in
  // the row's label instead.
  const { byId } = useTaskPeople()
  const assignee = task.assigneeId ? byId.get(task.assigneeId) : undefined
  const spoken = assignee
    ? `${label ?? task.title}, ${fmt(t.tasks.assignee.assignedTo, { name: assignee.name })}`
    : (label ?? task.title)
  const coin = assignee ? <AssigneeCoin initial={assignee.initial} /> : null

  const completeTask = useCompleteTask()
  // A parent with open subtasks asks first (APP-304).
  const toggle = () => completeTask(task, onToggled)

  const title = (
    <Text
      style={[
        styles.title,
        {
          color: task.done ? tokens.muted : tokens.ink,
          textDecorationLine: task.done ? 'line-through' : 'none',
        },
      ]}
    >
      {task.title}
    </Text>
  )

  const box = <Checkbox checked={task.done} />

  // Just saved from the keyboard composer: a moment on the wash (APP-587).
  const fresh = useFresh(task.id)
  const row = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: fresh ? tokens.tintOf(fresh).wash : tokens.surface,
        },
        // On its way to the list's provider, which has to take it first.
        task.pending && styles.pending,
      ]}
    >
      {bar === undefined ? null : (
        <View style={[styles.bar, { backgroundColor: bar }]} />
      )}
      {onOpen ? (
        <>
          <Pressable
            testID={`toggle-${task.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done, disabled: !writable }}
            accessibilityLabel={label ?? task.title}
            disabled={!writable}
            hitSlop={12}
            onPress={toggle}
            style={styles.box}
          >
            {box}
          </Pressable>
          <Pressable
            testID={`task-${task.id}`}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            android_ripple={{ color: tokens.surface2 }}
            onPress={onOpen}
            style={({ pressed }) => [
              styles.open,
              separator,
              pressed &&
                Platform.OS !== 'android' && {
                  backgroundColor: tokens.surface2,
                },
            ]}
          >
            <View style={styles.text}>
              {title}
              {meta}
            </View>
            {trailing}
            {coin}
            {chevron ? (
              <UI_ICONS.ChevronRight
                size={17}
                color={tokens.muted}
                strokeWidth={2.2}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
          </Pressable>
        </>
      ) : (
        <Pressable
          testID={`toggle-${task.id}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done, disabled: !writable }}
          accessibilityLabel={label ?? task.title}
          disabled={!writable}
          onPress={toggle}
          style={({ pressed }) => [styles.whole, pressed && styles.pressed]}
        >
          <View style={styles.box}>{box}</View>
          <View style={[styles.open, separator]}>
            <View style={styles.text}>
              {title}
              {meta}
            </View>
            {trailing}
            {coin}
          </View>
        </Pressable>
      )}
    </View>
  )

  if (!menu) return row

  /**
   * The row, swipeable — with the hold menu wrapped around the *outside* of it.
   *
   * With the menu within the swipeable, iOS's context menu lifts a view
   * Reanimated is transforming: the row vanished on hold and the text juddered
   * on the way back, because UIKit and Reanimated were each deciding where it
   * was. From outside, the menu's source is the swipeable's own untransformed
   * container and the lift is the ordinary one.
   *
   * A read-only list gets neither swipe — both of them are writes — but it
   * keeps the menu, whose writing actions are disabled one by one.
   */
  const swipeable = writable ? (
    <ReanimatedSwipeable
      friction={1.6}
      leftThreshold={56}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={(direction) => {
        // `SwipeDirection` names the way the FINGER went, not which panel
        // opened: RIGHT is reported when the *left* panel came out.
        if (direction === SwipeDirection.RIGHT) {
          // Complete, and put the row back rather than leaving an open panel
          // behind a moved row.
          toggle()
          swipe.current?.close()
        } else {
          haptics.swipeThresholdPassed()
        }
      }}
      renderLeftActions={(_progress, _translation, methods) => {
        swipe.current = methods
        return (
          <View
            style={[styles.completeAction, { backgroundColor: tokens.accent }]}
          >
            <TASK_ICONS.CircleCheck
              size={20}
              color={tokens.onAccent}
              strokeWidth={2}
            />
            <Text style={[styles.actionText, { color: tokens.onAccent }]}>
              {task.done ? t.tasks.list.uncomplete : t.tasks.list.complete}
            </Text>
          </View>
        )
      }}
      renderRightActions={task.linked ? undefined : (_progress, _translation, methods) => (
        <View style={[styles.deleteAction, { backgroundColor: tokens.danger }]}>
          <Pressable
            testID={`delete-${task.id}`}
            accessibilityRole="button"
            accessibilityLabel={t.common.actions.delete}
            onPress={() => {
              methods.close()
              menu.onAction('delete')
            }}
            style={styles.actionPress}
          >
            <TASK_ICONS.Trash2 size={19} color={tokens.onInk} strokeWidth={2} />
            <Text style={[styles.actionText, { color: tokens.onInk }]}>
              {t.common.actions.delete}
            </Text>
          </Pressable>
        </View>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  ) : (
    row
  )

  return (
    <NativeContextMenu
      actions={taskMenuActions(task, t, {
        writable,
        reorder: menu.reorder,
        sections: menu.sections,
      })}
      onAction={menu.onAction}
    >
      {swipeable}
    </NativeContextMenu>
  )
}

/** The line at the bottom of a writable list that adds to it. */
export function TaskComposer({
  listId,
  placeholder,
  sectionId,
  parent,
  linked = false,
  onFailed,
}: {
  listId: string
  placeholder: string
  /** The section the composer sits in, which a new task joins (APP-357). */
  sectionId?: string
  /** Adds a subtask of this task instead (APP-304). */
  parent?: Pick<Task, 'id' | 'listId'>
  /** The list is linked: the line reads only what its provider can hold. */
  linked?: boolean
  /** Hears a line that could not be added, which is put back in the field. */
  onFailed?: () => void
}) {
  const tokens = useTokens('home')
  const actions = useTaskActions()
  const separator = useInsetSeparator()
  // Dates, repeats, @Member and #label are read off the line (APP-307),
  // except for a subtask.
  const recognise = !parent
  const {
    line: draft,
    parsed,
    today,
    setLine: setDraft,
    restore,
    dismiss,
    reset,
  } = useQuickAddLine(recognise, undefined, linked ? LINKED_KINDS : undefined)
  const { t } = useI18n()
  const writeFailed = useWriteFailed()

  const add = () => {
    const title = parsed.title
    if (!title) return
    const line = draft
    const read = parsed
    // Cleared first: the row appears the moment it is accepted, and a second
    // tap cannot submit the same line twice while the write is in flight.
    reset()
    // Answers whether a typed time could not become the reminder.
    const write: Promise<boolean> = parent
      ? actions.addSubtask(parent, title).then(() => false)
      : actions
          .addParsedTask(listId, read, sectionId)
          .then((saved) => saved.reminderFailed)
    write.then(
      (reminderFailed) => {
        haptics.itemSaved()
        // A haptic is never the only word, and the task did go in.
        if (reminderFailed) showAlert(t.tasks.quickAdd.reminderFailed)
      },
      (error: unknown) => {
        writeFailed(error)
        if (parent) {
          restore(title)
          if (!(error instanceof LinkedWriteError)) onFailed?.()
        } else {
          // The whole line, so what was recognised is recognised again.
          restore(line)
        }
      },
    )
  }

  const field = (
    <View style={styles.row}>
      <View style={styles.box}>
        <UI_ICONS.Plus
          size={20}
          color={tokens.accentText}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <QuickAddInput
        testID={parent ? 'subtask-composer' : 'task-composer'}
        line={draft}
        parsed={parsed}
        onChangeText={setDraft}
        onSubmitEditing={add}
        // Stays focused after adding, so the next line can be typed at once
        // and the keyboard does not close and reopen under the list (APP-521).
        submitBehavior="submit"
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        returnKeyType="done"
        accessibilityLabel={placeholder}
        style={[
          styles.composerInput,
          parsed.parts.length === 0 && separator,
          { color: tokens.ink },
        ]}
      />
    </View>
  )
  // The chips sit under the line, where the hairline then goes. The field
  // keeps its place in the tree as they come and go: a remounted input
  // would drop its focus, and the keyboard, mid-word.
  return (
    <View>
      {field}
      {parsed.parts.length > 0 ? (
        <View style={[styles.composerChips, separator]}>
          <QuickAddChips parsed={parsed} today={today} onDismiss={dismiss} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // The `InsetList` row: the leading box, then a text column that carries the
  // separator, so the hairline starts where the text does.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACE[4],
  },
  pending: { opacity: 0.5 },
  whole: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  bar: {
    position: 'absolute',
    left: SPACE[1] + 2,
    top: SPACE[3],
    bottom: SPACE[3],
    width: 3,
    borderRadius: 2,
  },
  box: {
    width: CHECK_RING,
    marginRight: SPACE[3],
    alignItems: 'center',
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: SIZE.rowMin,
    paddingRight: SPACE[4],
  },
  text: { flex: 1, gap: SPACE[1], paddingVertical: SPACE[2] },
  title: { ...TYPE.body },
  pressed: { opacity: 0.6 },
  completeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  deleteAction: { justifyContent: 'center' },
  actionPress: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
  },
  actionText: { ...TYPE.footnoteStrong },
  composerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE[2],
    marginLeft: SPACE[4] + CHECK_RING + SPACE[3],
    paddingRight: SPACE[4],
    paddingBottom: SPACE[3],
  },
  composerInput: {
    ...TYPE.body,
    flex: 1,
    minHeight: SIZE.rowMin,
    paddingVertical: SPACE[3],
    paddingRight: SPACE[4],
  },
})
