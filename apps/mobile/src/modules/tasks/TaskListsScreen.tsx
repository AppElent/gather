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
 *   differs is what you may do to it — and that difference belongs on the list
 *   itself (ADR-0021), which is where the next screen puts it.
 */
import { Stack, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fmt, type Messages, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { useTokens } from '../../theme/tokens'
import { Card, PressRow, SectionLabel } from './components'
import { TASK_ICONS } from './icons'
import { useTaskState } from './store'
import { TaskRow } from './TaskRow'
import { useTaskSheets } from './taskMenu'
import type { Task, TaskList } from './types'

export function TaskLists() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const router = useRouter()
  const state = useTaskState()
  const taskSheets = useTaskSheets()
  const ChevronRight = UI_ICONS.ChevronRight

  const lists = [...state.lists].sort((a, b) => a.order - b.order)
  const listOf = (id: string) => lists.find((list) => list.id === id)

  // Overdue counts as today: a date that has been and gone is not a reason to
  // stop showing it, and a second "Overdue" strip would split one answer in
  // two.
  const due = state.tasks
    .filter((task) => !task.done && task.dueDate && task.dueDate <= state.today)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t.tasks.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.group}>
          <SectionLabel>{t.tasks.today}</SectionLabel>
          <Card>
            {due.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={[styles.empty, { color: tokens.muted }]}>
                  {t.tasks.todayEmpty}
                </Text>
              </View>
            ) : (
              due.map((task, index) => {
                const overdue = (task.dueDate ?? '') < state.today
                const inList = fmt(t.tasks.inList, {
                  list: listOf(task.listId)?.name ?? '',
                })
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    writable={listOf(task.listId)?.writable ?? false}
                    last={index === due.length - 1}
                    chevron
                    meta={
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.meta,
                          { color: overdue ? tokens.danger : tokens.muted },
                        ]}
                      >
                        {overdue
                          ? `${t.tasks.task.overdue} \u00b7 ${inList}`
                          : inList}
                      </Text>
                    }
                    onOpen={() =>
                      router.push({
                        pathname: '/all/tasks/task/[taskId]',
                        params: { taskId: task.id },
                      })
                    }
                    menu={{
                      reorder: false,
                      onAction: (action) => taskSheets.onAction(task, action),
                    }}
                  />
                )
              })
            )}
          </Card>
        </View>

        <View style={styles.group}>
          <SectionLabel>{t.tasks.lists}</SectionLabel>
          <Card>
            {lists.map((list, index) => {
              const count = openCount(list, state.tasks, t)
              return (
                <PressRow
                  key={list.id}
                  testID={`list-${list.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${list.name}, ${count}`}
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
                          {t.tasks.linked} · {list.provider}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.count, { color: tokens.muted }]}>
                    {count}
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

/** How many tasks are left on a list, or that its provider did not answer. */
function openCount(
  list: TaskList,
  tasks: readonly Task[],
  t: Messages,
): string {
  if (list.sync === 'reconnect' || list.sync === 'failed') {
    return t.tasks.notLoaded
  }
  const open = tasks.filter(
    (task) => task.listId === list.id && !task.done,
  ).length
  if (open === 0) return t.tasks.allDone
  if (open === 1) return t.tasks.openOne
  return fmt(t.tasks.open, { count: open })
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 18 },
  group: { gap: 8 },
  emptyRow: { minHeight: 50, justifyContent: 'center' },
  empty: { fontSize: 14 },
  meta: { fontSize: 12, fontWeight: '700' },
  listText: { flex: 1, gap: 3, paddingVertical: 7 },
  listName: { fontSize: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
  count: { fontSize: 13.5 },
})
