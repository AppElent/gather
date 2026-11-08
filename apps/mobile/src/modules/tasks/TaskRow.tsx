/**
 * A task as a row, and the two things every list of rows ends with.
 *
 * One row for every place a task is drawn — a list, the Today strip, a
 * checklist inside another Module — so a tick, a swipe and a hold mean the same
 * thing wherever the task appears.
 */
import { type ReactNode, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import { Checkbox } from './components'
import { TASK_ICONS } from './icons'
import { useTaskActions } from './store'
import { taskMenuActions } from './taskMenu'
import type { Task } from './types'

const COMPLETE_GREEN = '#3f7d4e'

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
  last,
  onOpen,
  menu,
  bar,
  meta,
  chevron = false,
  onToggled,
}: {
  task: Task
  writable: boolean
  last: boolean
  onOpen?: () => void
  /** The hold menu and both swipes. Reorder appears only inside a list. */
  menu?: { reorder: boolean; onAction: (action: string) => void }
  /** The priority bar's colour; no bar at all when absent. */
  bar?: string
  /** What sits under the title. */
  meta?: ReactNode
  chevron?: boolean
  /** Whether the server took the tick. */
  onToggled?: (ok: boolean) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const actions = useTaskActions()
  const swipe = useRef<SwipeableMethods | null>(null)

  const toggle = () => {
    if (!task.done) haptics.itemCompleted()
    actions.toggleTask(task.id).then(
      () => onToggled?.(true),
      () => {
        haptics.actionFailed()
        onToggled?.(false)
      },
    )
  }

  const title = (
    <Text
      numberOfLines={onOpen ? 1 : undefined}
      style={[
        styles.title,
        {
          color: task.done ? tokens.muted : tokens.fg,
          textDecorationLine: task.done ? 'line-through' : 'none',
        },
      ]}
    >
      {task.title}
    </Text>
  )

  const box = <Checkbox checked={task.done} />

  const row = (
    <View
      style={[
        styles.row,
        {
          backgroundColor: tokens.surface,
          borderBottomColor: tokens.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
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
            accessibilityLabel={task.title}
            disabled={!writable}
            hitSlop={12}
            onPress={toggle}
          >
            {box}
          </Pressable>
          <Pressable
            testID={`task-${task.id}`}
            accessibilityRole="button"
            accessibilityLabel={task.title}
            android_ripple={{ color: tokens.tile }}
            onPress={onOpen}
            style={({ pressed }) => [
              styles.open,
              pressed &&
                Platform.OS !== 'android' && { backgroundColor: tokens.tile },
            ]}
          >
            <View style={styles.text}>
              {title}
              {meta}
            </View>
            {chevron ? (
              <UI_ICONS.ChevronRight
                size={18}
                color={tokens.muted}
                strokeWidth={1.8}
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
          accessibilityLabel={task.title}
          disabled={!writable}
          onPress={toggle}
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        >
          {box}
          <View style={styles.text}>
            {title}
            {meta}
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
            style={[styles.completeAction, { backgroundColor: COMPLETE_GREEN }]}
          >
            <TASK_ICONS.CircleCheck size={20} color="#ffffff" strokeWidth={2} />
            <Text style={styles.actionText}>
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
            accessibilityLabel={t.actions.delete}
            onPress={() => {
              methods.close()
              menu.onAction('delete')
            }}
            style={styles.actionPress}
          >
            <TASK_ICONS.Trash2 size={19} color="#ffffff" strokeWidth={2} />
            <Text style={styles.actionText}>{t.actions.delete}</Text>
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
      actions={taskMenuActions(task, t, { writable, reorder: menu.reorder })}
      onAction={menu.onAction}
    >
      {swipeable}
    </NativeContextMenu>
  )
}

/** The fold between a list's open tasks and its completed ones. */
export function CompletedToggle({
  count,
  open,
  onPress,
}: {
  count: number
  open: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  return (
    <Pressable
      testID="completed-toggle"
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={
        open ? t.actions.hideCompleted : t.actions.showCompleted
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.completedToggle,
        { borderTopColor: tokens.border },
        pressed && { backgroundColor: tokens.tile },
      ]}
    >
      <Text style={[styles.completedLabel, { color: tokens.muted }]}>
        {fmt(t.actions.completed, { count })}
      </Text>
      <View style={open ? styles.flipped : undefined}>
        <UI_ICONS.ChevronDown size={18} color={tokens.muted} />
      </View>
    </Pressable>
  )
}

/** The line at the bottom of a writable list that adds to it. */
export function TaskComposer({
  listId,
  placeholder,
}: {
  listId: string
  placeholder: string
}) {
  const tokens = useTokens('home')
  const actions = useTaskActions()
  const [draft, setDraft] = useState('')

  const add = () => {
    const title = draft.trim()
    if (!title) return
    // Cleared first: the row appears the moment it is accepted, and a second
    // tap cannot submit the same line twice while the write is in flight.
    setDraft('')
    actions.addTask(listId, title).then(
      () => haptics.itemSaved(),
      () => haptics.actionFailed(),
    )
  }

  return (
    <View style={styles.composer}>
      <TASK_ICONS.Plus
        size={17}
        color={tokens.tintOf('home').fg}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <TextInput
        testID="task-composer"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        returnKeyType="done"
        accessibilityLabel={placeholder}
        style={[styles.composerInput, { color: tokens.fg }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginVertical: 12,
    marginLeft: -8,
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
  },
  text: { flex: 1, gap: 5, paddingVertical: 9 },
  title: { fontSize: 15.5 },
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
  actionText: { fontSize: 12.5, fontWeight: '700', color: '#ffffff' },
  completedToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  completedLabel: { fontSize: 15, fontWeight: '600' },
  flipped: { transform: [{ rotate: '180deg' }] },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  composerInput: { flex: 1, fontSize: 15.5, paddingVertical: 12 },
})
