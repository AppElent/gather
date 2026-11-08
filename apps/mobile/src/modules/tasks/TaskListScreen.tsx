/**
 * Tasks, level two: one list, whole.
 *
 * Three decisions are load-bearing:
 *
 * - **Rich rows, with a switch.** A row can carry a priority bar, a due date
 *   and its labels. Which of those it draws is a per-list setting in the list's
 *   own ⋯ menu, and with all three off the row collapses to the plain checklist
 *   line. That is what makes "rich vs plain" a setting instead of an argument.
 * - **Reorder is a mode**, reachable from both the row's hold menu and the
 *   list's ⋯ — see `ReorderMode.tsx`.
 * - **A list Gather cannot write to says so and hides its composer**
 *   (ADR-0021). It is also the only list here with pull-to-refresh, because it
 *   is the only one Convex is not keeping live.
 */
import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import { Stack, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
// Gesture Handler's own ScrollView, not React Native's: reorder's drag names
// this view in `blocksExternalGesture`, and only a scroll view the library
// knows about can be told to stand down for one touch. Gesture Handler 3's
// `ScrollView` no longer puts a handler tag on its ref, so this is the legacy one
// until reorder moves to the v3 gesture hooks.
import { LegacyScrollView as ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { Chip, priorityColor } from './components'
import { TASK_ICONS } from './icons'
import { ReorderMode } from './ReorderMode'
import { RenameSheet } from './sheets'
import { taskSections, useTaskActions, useTaskList } from './store'
import { CompletedToggle, TaskComposer, TaskRow } from './TaskRow'
import { dueLabel, isOverdue } from './taskDates'
import { useTaskSheets } from './taskMenu'
import type { ListDisplay, Task, TaskList as TaskListModel } from './types'

/** A menu entry an owning module adds to the list's ⋯ menu. */
export interface ListMenuExtra {
  id: string
  title: string
  image: MenuAction['image']
  onPress: () => void
}

export function TaskList({
  listId,
  menuExtras = [],
  addPlaceholder,
}: {
  listId: string
  /**
   * What an owning module adds to the list's own menu. Never the back button:
   * the system Back is the one way out of a pushed screen.
   */
  menuExtras?: readonly ListMenuExtra[]
  /** The composer's words, when the list is not a list of tasks. */
  addPlaceholder?: string
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const { list, tasks, today, refresh } = useTaskList(listId)
  const actions = useTaskActions()

  const [renamingList, setRenamingList] = useState(false)
  const [reordering, setReordering] = useState(false)
  const taskSheets = useTaskSheets({ onReorder: () => setReordering(true) })
  const scrollRef = useRef<ScrollView>(null)
  const [dragging, setDragging] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)

  const { active, completed } = taskSections(tasks)

  if (!list) {
    // The only way here is deleting the list from its own screen, which pops.
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />
  }

  const confirmDeleteList = () => {
    confirmDestructive({
      title: fmt(t.tasks.list.deleteTitle, { title: list.name }),
      message: t.tasks.list.deleteBody,
      confirm: t.actions.delete,
      cancel: t.actions.cancel,
      onConfirm: () => {
        actions.deleteList(list.id)
        router.back()
      },
    })
  }

  const onListMenu = (action: string) => {
    if (action === 'due' || action === 'priority' || action === 'labels') {
      actions.setListDisplay(list, { [action]: !list.display[action] })
      haptics.selectionChanged()
      return
    }
    if (action === 'reorder') setReordering(true)
    if (action === 'rename') setRenamingList(true)
    if (action === 'delete') confirmDeleteList()
    menuExtras.find((extra) => extra.id === action)?.onPress()
  }

  const onRefresh = async () => {
    setRefreshing(true)
    haptics.refreshStarted()
    const sync = await refresh()
    setRefreshing(false)
    setRefreshed(sync === 'synced')
    if (sync !== 'synced') haptics.actionFailed()
  }

  const openTask = (task: Task) =>
    router.push({
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: task.id },
    })

  const row = (task: Task, last: boolean) => (
    <TaskRow
      key={task.id}
      task={task}
      writable={list.writable}
      last={last}
      bar={
        (list.display.priority &&
          priorityColor(task.priority, tokens.danger)) ||
        'transparent'
      }
      meta={<TaskMeta task={task} display={list.display} today={today} />}
      onOpen={() => openTask(task)}
      menu={{
        reorder: true,
        onAction: (action) => taskSheets.onAction(task, action),
      }}
    />
  )

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
                    title: t.tasks.list.display,
                    displayInline: true,
                    subactions: [
                      {
                        id: 'due',
                        title: t.tasks.list.dueDates,
                        state: list.display.due ? 'on' : 'off',
                      },
                      {
                        id: 'priority',
                        title: t.tasks.list.priority,
                        state: list.display.priority ? 'on' : 'off',
                      },
                      {
                        id: 'labels',
                        title: t.tasks.list.labels,
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
                    title: t.tasks.list.rename,
                    image: 'pencil',
                    attributes: { disabled: !list.writable },
                  },
                  ...menuExtras.map(({ id, title, image }) => ({
                    id,
                    title,
                    image,
                  })),
                  {
                    id: 'delete',
                    title: t.tasks.list.deleteList,
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ]}
                onPressAction={(event) => onListMenu(event.nativeEvent.event)}
              >
                <View style={styles.headerButton}>
                  <UI_ICONS.Ellipsis
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
              onRefresh={onRefresh}
              tintColor={tokens.muted}
            />
          )
        }
      >
        {reordering ? (
          <ReorderMode
            tasks={active}
            display={list.display}
            today={today}
            scrollRef={scrollRef}
            onDragging={setDragging}
            onCommit={(ids) => actions.reorderTasks(list.id, ids)}
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
                <Text
                  style={[
                    styles.readOnlyText,
                    {
                      color:
                        list.sync === 'reconnect' || list.sync === 'failed'
                          ? tokens.danger
                          : tokens.muted,
                    },
                  ]}
                >
                  {syncNotice(list, refreshed, t)}
                </Text>
              </View>
            )}

            <Card>
              {active.length === 0 && completed.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={[styles.empty, { color: tokens.muted }]}>
                    {list.sync === 'loading'
                      ? fmt(t.tasks.list.loading, { provider: list.provider })
                      : t.tasks.list.empty}
                  </Text>
                </View>
              ) : null}

              {active.map((task, index) =>
                row(
                  task,
                  index === active.length - 1 &&
                    completed.length === 0 &&
                    !list.writable,
                ),
              )}

              {completed.length > 0 ? (
                <>
                  <CompletedToggle
                    count={completed.length}
                    open={completedOpen}
                    onPress={() => setCompletedOpen((open) => !open)}
                  />
                  {completedOpen
                    ? completed.map((task) => row(task, false))
                    : null}
                </>
              ) : null}

              {list.writable ? (
                <TaskComposer
                  listId={list.id}
                  placeholder={addPlaceholder ?? t.tasks.list.addTask}
                />
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>

      {taskSheets.sheets}
      {renamingList ? (
        <RenameSheet
          title={t.tasks.list.rename}
          value={list.name}
          onSave={(next) => actions.renameList(list.id, next)}
          onClose={() => setRenamingList(false)}
        />
      ) : null}
    </>
  )
}

/** What the banner over a linked list says about where its rows came from. */
function syncNotice(list: TaskListModel, refreshed: boolean, t: Messages) {
  const provider = { provider: list.provider }
  if (list.sync === 'reconnect') return fmt(t.tasks.list.reconnect, provider)
  if (list.sync === 'failed') return fmt(t.tasks.list.failed, provider)
  const readOnly = fmt(t.tasks.list.readOnly, provider)
  return refreshed && list.sync === 'synced'
    ? `${readOnly} ${t.tasks.list.refreshed}.`
    : readOnly
}

/** The due date, priority and labels a list's display settings ask for. */
function TaskMeta({
  task,
  display,
  today,
}: {
  task: Task
  display: ListDisplay
  today: string
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const shown =
    (display.due && task.dueDate) ||
    (display.priority && task.priority) ||
    (display.labels && task.labels.length > 0)
  if (!shown) return null

  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate, today))
  const flag = priorityColor(task.priority, tokens.danger) ?? tokens.muted

  return (
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
              today: t.tasks.task.today,
              tomorrow: t.tasks.task.tomorrow,
            })}
          </Text>
        </View>
      ) : null}
      {display.priority && task.priority ? (
        <View style={styles.metaItem}>
          <TASK_ICONS.Flag
            size={12}
            color={flag}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.meta, { color: flag }]}>
            {t.tasks.task.priorities[task.priority]}
          </Text>
        </View>
      ) : null}
      {display.labels
        ? task.labels.map((label) => <Chip key={label} label={label} />)
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  /**
   * A navigation-bar action, dressed the way the platform dresses one: 17pt
   * in the tint colour, semibold because this is the confirming action of a
   * mode. Not `fg` — a bar button that is the same colour as the title does
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 12, fontWeight: '700' },
})
