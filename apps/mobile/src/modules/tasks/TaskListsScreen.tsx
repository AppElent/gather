/**
 * Tasks, level one: every list in the Group, with what is due today above them.
 *
 * Two decisions from the canvas are drawn here rather than argued:
 *
 * - **Today is a strip, not a list.** Tasks due today come from every list at
 *   once and are tickable where they stand, because "what do I have to do
 *   today" is the question this screen is opened with, and answering it by
 *   making somebody visit four lists is not answering it.
 *
 *   Tickable *where they stand* is not the same as tickable *anywhere on the
 *   row*: the box ticks and the rest of the row opens the task, exactly as a
 *   row inside a list behaves. A row that looks identical one screen down and
 *   answers a tap differently is a trap, and the small target that split
 *   buys back is what `hitSlop` is for.
 * - **A linked list is marked, not filed separately.** Notion and Todoist
 *   lists sit in the same card as local ones with a badge, because where a
 *   list is stored is a property of the list and not a category of list. What
 *   differs is what you may do to it â€” and that difference belongs on the list
 *   itself (ADR-0021), which is where the next screen puts it.
 */
import { Stack, useRouter } from 'expo-router'
import { useRef } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import { Card, Checkbox, PressRow, SectionLabel } from './components'
import { TASK_ICONS } from './icons'
import { taskActions, useTaskState } from './store'
import { taskMenuActions, useTaskSheets } from './taskMenu'
import type { Task } from './types'

export function TaskLists() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const state = useTaskState()
  const taskSheets = useTaskSheets()
  const ChevronRight = UI_ICONS.ChevronRight

  const lists = [...state.lists].sort((a, b) => a.order - b.order)
  const listName = (id: string) =>
    lists.find((list) => list.id === id)?.name ?? ''

  // Overdue counts as today: a date that has been and gone is not a reason to
  // stop showing it, and a second "Overdue" strip would split one answer in
  // two.
  const due = state.tasks
    .filter((task) => !task.done && task.dueDate && task.dueDate <= state.today)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t.labs.tasks.title }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.group}>
          <SectionLabel>{t.labs.tasks.today}</SectionLabel>
          <Card>
            {due.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.empty, { color: tokens.muted }]}>
                  {t.labs.tasks.todayEmpty}
                </Text>
              </View>
            ) : (
              due.map((task, index) => (
                <TodayRow
                  key={task.id}
                  task={task}
                  listName={listName(task.listId)}
                  writable={
                    state.lists.find((list) => list.id === task.listId)
                      ?.writable ?? false
                  }
                  overdue={(task.dueDate ?? '') < state.today}
                  last={index === due.length - 1}
                  onOpen={() =>
                    router.push({
                      pathname: '/all/tasks/task/[taskId]',
                      params: { taskId: task.id },
                    })
                  }
                  onMenu={(action) => taskSheets.onAction(task, action)}
                />
              ))
            )}
          </Card>
        </View>

        <View style={styles.group}>
          <SectionLabel>{t.labs.tasks.lists}</SectionLabel>
          <Card>
            {lists.map((list, index) => {
              const open = state.tasks.filter(
                (task) => task.listId === list.id && !task.done,
              ).length
              return (
                <PressRow
                  key={list.id}
                  testID={`list-${list.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${list.name}, ${
                    open === 1
                      ? t.labs.tasks.openOne
                      : fmt(t.labs.tasks.open, { count: open })
                  }`}
                  last={index === lists.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: '/all/tasks/[listId]',
                      params: { listId: list.id },
                    })
                  }
                >
                  <View style={styles.listText}>
                    <Text
                      numberOfLines={1}
                      style={[styles.listName, { color: tokens.fg }]}
                    >
                      {list.name}
                    </Text>
                    {list.provider === 'local' ? null : (
                      <View style={styles.badge}>
                        <TASK_ICONS.Link
                          size={12}
                          color={tokens.muted}
                          strokeWidth={2.2}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                        <Text
                          style={[styles.badgeText, { color: tokens.muted }]}
                        >
                          {t.labs.tasks.linked} Â· {list.provider}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.count, { color: tokens.muted }]}>
                    {open === 0
                      ? t.labs.tasks.allDone
                      : open === 1
                        ? t.labs.tasks.openOne
                        : fmt(t.labs.tasks.open, { count: open })}
                  </Text>
                  <ChevronRight
                    size={18}
                    color={tokens.muted}
                    strokeWidth={1.8}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </PressRow>
              )
            })}
          </Card>
        </View>
      </ScrollView>

      {taskSheets.sheets}
    </>
  )
}

/**
 * One task on the Today strip.
 *
 * It answers exactly what a row inside a list answers - tap the box to tick,
 * tap the row to open, swipe to complete or delete, hold for the menu - and it
 * has to, because it is the same object drawn at the same size one screen up.
 * The first draft made it a digest with no gestures at all, which reads as a
 * list right up until you try to use it as one.
 *
 * The one difference is that the menu carries no Reorder: rearranging belongs
 * to a list, and this strip is a view across every list at once.
 * `taskMenuActions` hides it, rather than each screen writing its own menu and
 * drifting from the other again.
 */
function TodayRow({
  task,
  listName,
  writable,
  overdue,
  last,
  onOpen,
  onMenu,
}: {
  task: Task
  listName: string
  writable: boolean
  overdue: boolean
  last: boolean
  onOpen: () => void
  onMenu: (action: string) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const swipe = useRef<SwipeableMethods | null>(null)
  const ChevronRight = UI_ICONS.ChevronRight

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
      <Pressable
        testID={`today-toggle-${task.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false, disabled: !writable }}
        accessibilityLabel={task.title}
        disabled={!writable}
        hitSlop={12}
        onPress={() => {
          taskActions.toggleTask(task.id)
          haptics.itemCompleted()
        }}
      >
        <Checkbox checked={false} />
      </Pressable>
      <Pressable
        testID={`today-${task.id}`}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        android_ripple={{ color: tokens.tile }}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.todayPress,
          pressed &&
            Platform.OS !== 'android' && { backgroundColor: tokens.tile },
        ]}
      >
        <View style={styles.todayText}>
          <Text
            numberOfLines={1}
            style={[styles.taskTitle, { color: tokens.fg }]}
          >
            {task.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.meta,
              { color: overdue ? tokens.danger : tokens.muted },
            ]}
          >
            {overdue
              ? `${t.labs.task.overdue} \u00b7 ${fmt(t.labs.tasks.inList, { list: listName })}`
              : fmt(t.labs.tasks.inList, { list: listName })}
          </Text>
        </View>
        <ChevronRight
          size={18}
          color={tokens.muted}
          strokeWidth={1.8}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </Pressable>
    </View>
  )

  // The same nesting the list's rows use: the hold menu wraps the swipeable
  // and never the other way round, or iOS lifts a view Reanimated is moving.
  const swipeable = writable ? (
    <ReanimatedSwipeable
      friction={1.6}
      leftThreshold={56}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={(direction) => {
        // RIGHT names the finger's direction, which reveals the LEFT panel.
        if (direction === SwipeDirection.RIGHT) {
          haptics.itemCompleted()
          taskActions.toggleTask(task.id)
          swipe.current?.close()
        } else {
          haptics.swipeThresholdPassed()
        }
      }}
      renderLeftActions={(_progress, _translation, methods) => {
        swipe.current = methods
        return (
          <View style={[styles.completeAction, { backgroundColor: '#3f7d4e' }]}>
            <TASK_ICONS.CircleCheck size={20} color="#ffffff" strokeWidth={2} />
            <Text style={styles.actionText}>{t.labs.list.complete}</Text>
          </View>
        )
      }}
      renderRightActions={(_progress, _translation, methods) => (
        <View style={[styles.deleteAction, { backgroundColor: tokens.danger }]}>
          <Pressable
            testID={`today-delete-${task.id}`}
            accessibilityRole="button"
            accessibilityLabel={t.actions.delete}
            onPress={() => {
              methods.close()
              onMenu('delete')
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
      actions={taskMenuActions(task, t, { writable, reorder: false })}
      onAction={onMenu}
    >
      {swipeable}
    </NativeContextMenu>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 18 },
  group: { gap: 8 },
  emptyRow: { minHeight: 50, justifyContent: 'center' },
  empty: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 50 },
  completeAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  deleteAction: { flex: 1, alignItems: 'flex-end' },
  actionPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: '100%',
  },
  actionText: { color: '#ffffff', fontSize: 13.5, fontWeight: '700' },
  todayPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
  },
  todayText: { flex: 1, gap: 3, paddingVertical: 7 },
  taskTitle: { fontSize: 15.5 },
  meta: { fontSize: 12, fontWeight: '700' },
  listText: { flex: 1, gap: 3, paddingVertical: 7 },
  listName: { fontSize: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  count: { fontSize: 13.5 },
})
