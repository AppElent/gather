/**
 * Tasks, level two: one list, whole.
 *
 * This is the screen the canvas spent the most argument on, and three of its
 * decisions are load-bearing:
 *
 * - **Rich rows, with a switch.** A row can carry a priority bar, a due date
 *   and its labels. Which of those it draws is a per-list setting in the list's
 *   own â‹¯ menu, and with all three off the row collapses to exactly the plain
 *   checklist `modules/baby/Checklist.tsx` draws. That is what makes "rich vs
 *   plain" a setting instead of an argument.
 * - **Reorder is a mode**, reachable from both the row's hold menu and the
 *   list's â‹¯ â€” see `ReorderMode.tsx`.
 * - **A list Gather cannot write to says so and hides its composer**
 *   (ADR-0021). It is also the only list here with pull-to-refresh, because it
 *   is the only one Convex is not keeping live.
 *
 * Every write goes to the fixture store; nothing here calls Convex. See
 * `fixtures.ts` for why.
 */
import { MenuView } from '@expo/ui/community/menu'
import { Stack, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
// Gesture Handler's own ScrollView, not React Native's: reorder's drag names
// this view in `blocksExternalGesture`, and only a scroll view the library
// knows about can be told to stand down for one touch.
import { ScrollView } from 'react-native-gesture-handler'
import ReanimatedSwipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Card, Checkbox, Chip } from './components'
import { TASK_ICONS } from './icons'
import { ReorderMode } from './ReorderMode'
import { priorityColor, RenameSheet } from './sheets'
import { taskActions, useTaskState } from './store'
import { dueLabel, isOverdue } from './taskDates'
import { taskMenuActions, useTaskSheets } from './taskMenu'
import type { List, ListDisplay, Task } from './types'

export function TaskList({ listId }: { listId: string }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const state = useTaskState()

  const [renamingList, setRenamingList] = useState(false)
  const [reordering, setReordering] = useState(false)
  const taskSheets = useTaskSheets(() => setReordering(true))
  const scrollRef = useRef<ScrollView>(null)
  const [dragging, setDragging] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [synced, setSynced] = useState(false)

  const list = state.lists.find((each) => each.id === listId)
  const tasks = state.tasks
    .filter((task) => task.listId === listId)
    .sort((a, b) => a.order - b.order)
  const active = tasks.filter((task) => !task.done)
  const completed = tasks.filter((task) => task.done)

  if (!list) {
    // The only way here is deleting the list from its own screen, which pops.
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />
  }

  const addTask = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    taskActions.addTask(list.id, title)
    haptics.itemSaved()
  }

  const confirmDeleteList = () => {
    Alert.alert(
      fmt(t.labs.list.deleteTitle, { title: list.name }),
      t.labs.list.deleteBody,
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.actions.delete,
          style: 'destructive',
          onPress: () => {
            taskActions.deleteList(list.id)
            router.back()
          },
        },
      ],
    )
  }

  const onListMenu = (action: string) => {
    if (action === 'due' || action === 'priority' || action === 'labels') {
      taskActions.setListDisplay(list.id, { [action]: !list.display[action] })
      haptics.selectionChanged()
      return
    }
    if (action === 'reorder') setReordering(true)
    if (action === 'rename') setRenamingList(true)
    if (action === 'delete') confirmDeleteList()
  }

  const openTask = (task: Task) =>
    router.push({
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: task.id },
    })

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: list.name,
          headerRight: () =>
            reordering ? (
              <Pressable
                testID="reorder-done"
                accessibilityRole="button"
                accessibilityLabel={t.actions.done}
                hitSlop={12}
                onPress={() => setReordering(false)}
              >
                <Text style={[styles.headerDone, { color: tokens.accent }]}>
                  {t.actions.done}
                </Text>
              </Pressable>
            ) : (
              <MenuView
                testID="list-menu"
                actions={[
                  {
                    id: 'display',
                    title: t.labs.list.display,
                    displayInline: true,
                    subactions: [
                      {
                        id: 'due',
                        title: t.labs.list.dueDates,
                        state: list.display.due ? 'on' : 'off',
                      },
                      {
                        id: 'priority',
                        title: t.labs.list.priority,
                        state: list.display.priority ? 'on' : 'off',
                      },
                      {
                        id: 'labels',
                        title: t.labs.list.labels,
                        state: list.display.labels ? 'on' : 'off',
                      },
                    ],
                  },
                  {
                    id: 'reorder',
                    title: t.actions.reorder,
                    image: 'arrow.up.arrow.down',
                    attributes: { disabled: !list.writable },
                  },
                  {
                    id: 'rename',
                    title: t.labs.list.rename,
                    image: 'pencil',
                    attributes: { disabled: !list.writable },
                  },
                  {
                    id: 'delete',
                    title: t.labs.list.deleteList,
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ]}
                onPressAction={(event) => onListMenu(event.nativeEvent.event)}
              >
                <View style={styles.headerButton}>
                  <TASK_ICONS.Ellipsis
                    size={22}
                    color={tokens.fg}
                    strokeWidth={2.2}
                  />
                </View>
              </MenuView>
            ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          // Only a provider-backed list has anything to fetch. Convex keeps
          // the rest live, and a spinner over live data is theatre.
          list.writable ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                haptics.refreshStarted()
                setTimeout(() => {
                  setRefreshing(false)
                  setSynced(true)
                }, 900)
              }}
              tintColor={tokens.muted}
            />
          )
        }
      >
        {reordering ? (
          <ReorderMode
            tasks={active}
            display={list.display}
            today={state.today}
            scrollRef={scrollRef}
            onDragging={setDragging}
            onCommit={(ids) => taskActions.reorderTasks(list.id, ids)}
          />
        ) : (
          <>
            {list.writable ? null : (
              <View
                style={[
                  styles.readOnly,
                  { backgroundColor: tokens.tile, borderColor: tokens.border },
                ]}
              >
                <TASK_ICONS.Link
                  size={16}
                  color={tokens.muted}
                  strokeWidth={2.2}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={[styles.readOnlyText, { color: tokens.muted }]}>
                  {fmt(t.labs.list.readOnly, { provider: list.provider })}
                  {synced ? ` ${t.labs.list.refreshed}.` : ''}
                </Text>
              </View>
            )}

            <Card>
              {active.length === 0 && completed.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={[styles.empty, { color: tokens.muted }]}>
                    {t.labs.list.empty}
                  </Text>
                </View>
              ) : null}

              {active.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  list={list}
                  display={list.display}
                  today={state.today}
                  last={
                    index === active.length - 1 &&
                    completed.length === 0 &&
                    !list.writable
                  }
                  onOpen={() => openTask(task)}
                  onMenu={(action) => taskSheets.onAction(task, action)}
                />
              ))}

              {completed.length > 0 ? (
                <>
                  <Pressable
                    testID="completed-toggle"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: completedOpen }}
                    accessibilityLabel={
                      completedOpen
                        ? t.actions.hideCompleted
                        : t.actions.showCompleted
                    }
                    onPress={() => setCompletedOpen((open) => !open)}
                    style={({ pressed }) => [
                      styles.completedToggle,
                      { borderTopColor: tokens.border },
                      pressed && { backgroundColor: tokens.tile },
                    ]}
                  >
                    <Text
                      style={[styles.completedLabel, { color: tokens.muted }]}
                    >
                      {fmt(t.actions.completed, { count: completed.length })}
                    </Text>
                    <View style={completedOpen ? styles.flipped : undefined}>
                      <UI_ICONS.ChevronDown size={18} color={tokens.muted} />
                    </View>
                  </Pressable>
                  {completedOpen
                    ? completed.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          list={list}
                          display={list.display}
                          today={state.today}
                          last={false}
                          onOpen={() => openTask(task)}
                          onMenu={(action) => taskSheets.onAction(task, action)}
                        />
                      ))
                    : null}
                </>
              ) : null}

              {list.writable ? (
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
                    onSubmitEditing={addTask}
                    placeholder={t.labs.list.addTask}
                    placeholderTextColor={tokens.muted}
                    returnKeyType="done"
                    accessibilityLabel={t.labs.list.addTask}
                    style={[styles.composerInput, { color: tokens.fg }]}
                  />
                </View>
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>

      {taskSheets.sheets}
      {renamingList ? (
        <RenameSheet
          title={t.labs.list.rename}
          value={list.name}
          onSave={(next) => taskActions.renameList(list.id, next)}
          onClose={() => setRenamingList(false)}
        />
      ) : null}
    </>
  )
}

/**
 * One task.
 *
 * Three ways in, which is the point: tap opens it, swipe right completes it,
 * hold opens the menu. The menu is never the only way to anything â€” every item
 * in it is also a row on the detail screen.
 */
function TaskRow({
  task,
  list,
  display,
  today,
  last,
  onOpen,
  onMenu,
}: {
  task: Task
  list: List
  display: ListDisplay
  today: string
  last: boolean
  onOpen: () => void
  onMenu: (action: string) => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const swipe = useRef<SwipeableMethods | null>(null)

  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate, today))
  const bar = display.priority
    ? priorityColor(task.priority, tokens.danger)
    : undefined
  const meta =
    (display.due && task.dueDate) ||
    (display.priority && task.priority) ||
    (display.labels && task.labels.length > 0)

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
      <View style={[styles.bar, { backgroundColor: bar ?? 'transparent' }]} />
      <Pressable
        testID={`toggle-${task.id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done, disabled: !list.writable }}
        accessibilityLabel={task.title}
        disabled={!list.writable}
        hitSlop={10}
        onPress={() => {
          taskActions.toggleTask(task.id)
          if (!task.done) haptics.itemCompleted()
        }}
      >
        <Checkbox checked={task.done} />
      </Pressable>
      <Pressable
        testID={`task-${task.id}`}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        onPress={onOpen}
        style={styles.rowText}
      >
        <Text
          numberOfLines={1}
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
        {meta ? (
          <View style={styles.metaRow}>
            {display.due && task.dueDate ? (
              <View style={styles.metaItem}>
                <TASK_ICONS.Calendar
                  size={12}
                  color={overdue ? tokens.danger : tokens.muted}
                  strokeWidth={2.2}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text
                  style={[
                    styles.meta,
                    { color: overdue ? tokens.danger : tokens.muted },
                  ]}
                >
                  {dueLabel(task.dueDate, today, locale, {
                    today: t.labs.task.today,
                    tomorrow: t.labs.task.tomorrow,
                  })}
                </Text>
              </View>
            ) : null}
            {display.priority && task.priority ? (
              <View style={styles.metaItem}>
                <TASK_ICONS.Flag
                  size={12}
                  color={
                    priorityColor(task.priority, tokens.danger) ?? tokens.muted
                  }
                  strokeWidth={2.4}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text
                  style={[
                    styles.meta,
                    {
                      color:
                        priorityColor(task.priority, tokens.danger) ??
                        tokens.muted,
                    },
                  ]}
                >
                  {t.labs.task.priorities[task.priority]}
                </Text>
              </View>
            ) : null}
            {display.labels
              ? task.labels.map((label) => <Chip key={label} label={label} />)
              : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  )

  /**
   * The row, swipeable â€” with the hold menu wrapped around the *outside* of it.
   *
   * The nesting is the whole point, and it was inside out the first time. With
   * the menu within the swipeable, iOS's context menu lifts a view Reanimated
   * is transforming: the row vanished on hold and the text juddered on the way
   * back, because UIKit and Reanimated were each deciding where it was. From
   * outside, the menu's source is the swipeable's own untransformed container
   * and the lift is the ordinary one. Mail puts both on one row too.
   *
   * A read-only list gets neither swipe â€” both of them are writes â€” but it
   * keeps the menu, whose writing actions are disabled one by one.
   */
  const swipeable = list.writable ? (
    <ReanimatedSwipeable
      friction={1.6}
      leftThreshold={56}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={(direction) => {
        // `SwipeDirection` names the way the FINGER went, not which panel
        // opened â€” the library reports RIGHT when the *left* panel is what
        // came out. Reading it as the panel is why this completed on a
        // left-swipe and did nothing on a right one.
        if (direction === SwipeDirection.RIGHT) {
          // Swiping right reveals the left panel: complete, and put the row
          // back rather than leaving an open panel behind a moved row.
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
            <Text style={styles.actionText}>
              {task.done ? t.labs.list.uncomplete : t.labs.list.complete}
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

  const menu = (
    <NativeContextMenu
      actions={taskMenuActions(task, t, {
        writable: list.writable,
        reorder: true,
      })}
      onAction={onMenu}
    >
      {swipeable}
    </NativeContextMenu>
  )

  return menu
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  /**
   * A navigation-bar action, dressed the way the platform dresses one: 17pt
   * in the tint colour, semibold because this is the confirming action of a
   * mode. Not `fg` â€” a bar button that is the same colour as the title does
   * not read as something you can press.
   *
   * iOS 26 draws its own glass capsule around any *custom* header view, which
   * is why this looks like a button rather than bare text; the system reserves
   * plain text for real `UIBarButtonItem`s, and React Navigation's
   * `headerRight` is always a custom view. That is the OS's styling of a
   * native item, not ours to undo.
   */
  headerDone: { fontSize: 17, fontWeight: '600' },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  readOnlyText: { flex: 1, fontSize: 13, lineHeight: 19 },
  emptyRow: { minHeight: 50, justifyContent: 'center' },
  empty: { fontSize: 14 },
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
  rowText: { flex: 1, gap: 5, paddingVertical: 9 },
  title: { fontSize: 15.5 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12, fontWeight: '700' },
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
})
