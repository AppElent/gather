/**
 * A task as a row, and the two things every list of rows ends with.
 *
 * One row for every place a task is drawn — a list, the Today strip, a
 * checklist inside another Module — so a tick, a swipe and a hold mean the same
 * thing wherever the task appears.
 */
import type { GroceryAisle } from '@gather/core/groceries'
import { type ReactNode, type RefObject, useRef, useState } from 'react'
import {
  type HostInstance,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { LegacyScrollView as GestureScrollView } from 'react-native-gesture-handler'
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { useInsetSeparator } from '../../ui/inset-list'
import { AssigneeCoin, useTaskPeople } from './assignee'
import { useCompleteTask } from './completeTask'
import { Checkbox } from './components'
import { GroceryPreview } from './GroceryFields'
import { GroceryCompletions } from './GrocerySuggestions'
import { TASK_ICONS } from './icons'
import { useTaskActions } from './store'
import { taskMenuActions } from './taskMenu'
import type { Task } from './types'

/** Room kept between the composer and the keyboard after an add. */
const KEEP_CLEAR = SPACE[4]

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

  const row = (
    <View style={[styles.row, { backgroundColor: tokens.surface }]}>
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
      renderRightActions={(_progress, _translation, methods) => (
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
  grocery = false,
  sectionId,
  tasks,
  parent,
  onFailed,
  scrollRef,
}: {
  listId: string
  placeholder: string
  /** A grocery list: the amount is read off the line, and shown while typed. */
  grocery?: boolean
  /** The section the composer sits in, which a new task joins (APP-357). */
  sectionId?: string
  /**
   * A grocery list's items: with them, typing completes from the Group's
   * history and the bundled names (APP-311).
   */
  tasks?: readonly Task[]
  /** Adds a subtask of this task instead (APP-304). */
  parent?: Pick<Task, 'id' | 'listId'>
  /** Hears a line that could not be added, which is put back in the field. */
  onFailed?: () => void
  /**
   * The list's scroll view: each added row pushes the composer down, and
   * with the keyboard kept open it would slide under it (APP-521).
   */
  scrollRef?: RefObject<GestureScrollView | null>
}) {
  const tokens = useTokens('home')
  const actions = useTaskActions()
  const separator = useInsetSeparator()
  const [draft, setDraft] = useState('')
  // The aisle a Member chose in the preview, for the line it was chosen for
  // (APP-524): a line typed differently since has not been given one.
  const [choice, setChoice] = useState<{ line: string; aisle: GroceryAisle }>()
  const aisle = choice?.line === draft.trim() ? choice.aisle : undefined
  const fieldRef = useRef<HostInstance>(null)

  // Brings the field back above the keyboard once the new row has pushed it
  // down, and leaves the list alone while it is still in view.
  const keepInView = () => {
    requestAnimationFrame(() => {
      const field = fieldRef.current
      const scroll = scrollRef?.current
      if (!field || !scroll) return
      field.measureInWindow((_x, y, _width, height) => {
        const keyboard = Keyboard.metrics()
        if (!keyboard || y + height + KEEP_CLEAR <= keyboard.screenY) return
        scroll.scrollResponderScrollNativeHandleToKeyboard(
          field,
          KEEP_CLEAR,
          true,
        )
      })
    })
  }

  const add = () => {
    const title = draft.trim()
    if (!title) return
    // Cleared first: the row appears the moment it is accepted, and a second
    // tap cannot submit the same line twice while the write is in flight.
    setDraft('')
    setChoice(undefined)
    const write = parent
      ? actions.addSubtask(parent, title)
      : actions.addTask(listId, title, grocery, sectionId)
    write.then(
      (taskId) => {
        haptics.itemSaved()
        keepInView()
        // Then moved to the chosen aisle the way the item screen moves it, so
        // the Group keeps the choice for the name. Untouched, the server's
        // aisle stands. If only the move fails, the item is still added.
        if (grocery && aisle && taskId) {
          actions.setAisle(taskId, aisle).catch(() => haptics.actionFailed())
        }
      },
      () => {
        haptics.actionFailed()
        if (parent) {
          setDraft((now) => now || title)
          onFailed?.()
        }
      },
    )
  }

  const field = (
    <View ref={fieldRef} style={styles.row}>
      <View style={styles.box}>
        <UI_ICONS.Plus
          size={20}
          color={tokens.accentText}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
      <TextInput
        testID={parent ? 'subtask-composer' : 'task-composer'}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        // Stays focused after adding, so the next line can be typed at once
        // and the keyboard does not close and reopen under the list (APP-521).
        submitBehavior="submit"
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        returnKeyType="done"
        accessibilityLabel={placeholder}
        style={[styles.composerInput, separator, { color: tokens.ink }]}
      />
    </View>
  )
  if (!grocery) return field
  // The completions sit above the field: the list scrolls the field to just
  // above the keyboard, so anything under it would be covered.
  return (
    <View>
      {tasks ? (
        <GroceryCompletions
          listId={listId}
          line={draft}
          tasks={tasks}
          onPicked={() => setDraft('')}
        />
      ) : null}
      {field}
      <GroceryPreview
        listId={listId}
        line={draft}
        aisle={aisle}
        onAisle={(next) => setChoice({ line: draft.trim(), aisle: next })}
      />
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
  composerInput: {
    ...TYPE.body,
    flex: 1,
    minHeight: SIZE.rowMin,
    paddingVertical: SPACE[3],
    paddingRight: SPACE[4],
  },
})
