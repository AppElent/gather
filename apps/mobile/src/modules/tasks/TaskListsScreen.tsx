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

import { fmt, type Messages, plural, useI18n } from '../../i18n'
import { SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { TASK_ICONS } from './icons'
import { useTaskState } from './store'
import { TaskRow } from './TaskRow'
import { useTaskSheets } from './taskMenu'
import type { Task, TaskList } from './types'

export function TaskLists() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  const state = useTaskState()
  const taskSheets = useTaskSheets({ tasks: state.tasks })
  const tile = moduleTile('tasks')

  const lists = [...state.lists].sort((a, b) => a.order - b.order)
  const listOf = (id: string) => lists.find((list) => list.id === id)

  // Overdue counts as today: a date that has been and gone is not a reason to
  // stop showing it, and a second "Overdue" strip would split one answer in
  // two.
  const due = state.tasks
    .filter((task) => !task.done && task.dueDate && task.dueDate <= state.today)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  const openTotal = state.tasks.filter((task) => !task.done).length

  return (
    <>
      <Stack.Screen options={washScreenOptions(t.tasks.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: plural(locale, openTotal, t.tasks.count.open),
              scope: plural(locale, lists.length, t.tasks.count.lists),
            }}
          />
        ) : null}
        <View style={styles.content}>
          <View style={styles.group}>
            <SectionLabel>{t.tasks.today}</SectionLabel>
            <InsetList>
              {due.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={[styles.empty, { color: tokens.muted }]}>
                    {t.tasks.todayEmpty}
                  </Text>
                </View>
              ) : (
                due.map((task) => {
                  const overdue = (task.dueDate ?? '') < state.today
                  const inList = fmt(t.tasks.inList, {
                    list: listOf(task.listId)?.name ?? '',
                  })
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      writable={listOf(task.listId)?.writable ?? false}
                      chevron
                      meta={
                        <Text
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
            </InsetList>
          </View>

          <View style={styles.group}>
            <SectionLabel>{t.tasks.lists}</SectionLabel>
            <InsetList>
              {lists.map((list) => {
                const count = openCount(list, state.tasks, t)
                return (
                  <InsetRow
                    key={list.id}
                    testID={`list-${list.id}`}
                    accessibilityLabel={`${list.name}, ${count}`}
                    title={list.name}
                    chevron
                    trailing={
                      <Text style={[styles.count, { color: tokens.muted }]}>
                        {count}
                      </Text>
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/all/tasks/[listId]',
                        params: { listId: list.id },
                      })
                    }
                  >
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
                  </InsetRow>
                )
              })}
            </InsetList>
          </View>
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
  content: { paddingHorizontal: SPACE[4], gap: SPACE[5] },
  group: { gap: SPACE[2] },
  emptyRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  empty: { ...TYPE.subhead },
  meta: { ...TYPE.footnoteStrong },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { ...TYPE.footnoteStrong },
  count: { ...TYPE.footnote, ...TABULAR },
})
