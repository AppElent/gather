/**
 * A task's subtasks on its detail screen (APP-304, `designs/tasks` §4 item 3).
 *
 * Each subtask is a whole task, so each is an ordinary `TaskRow`: its own box,
 * its own assignee coin and date, a tap opens it, holding offers the task menu.
 * Reorder on that menu turns the section into the same `ReorderMode` a list
 * uses, with the subtasks as its rows. A subtask has no subtasks of its own,
 * so its own detail screen draws no section; neither does a grocery item.
 */
import { subtasksOf } from '@gather/core/subtasks'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { LegacyScrollView as GestureScrollView } from 'react-native-gesture-handler'

import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { TYPE, useTokens } from '../../theme/tokens'
import { InsetList } from '../../ui/inset-list'
import { TASK_ICONS } from './icons'
import { ReorderMode } from './ReorderMode'
import { SmartHeading } from './smart'
import { useTaskActions } from './store'
import { TaskComposer, TaskRow } from './TaskRow'
import { dueLabel, isOverdue } from './taskDates'
import type { Task, TaskList } from './types'

export function SubtaskSection({
  task,
  list,
  tasks,
  today,
  scrollRef,
  onDragging,
  onAction,
}: {
  task: Task
  list: TaskList
  /** Every task the phone holds; the subtasks are read from these. */
  tasks: readonly Task[]
  today: string
  scrollRef: React.RefObject<GestureScrollView | null>
  onDragging: (dragging: boolean) => void
  /** The task menu, for a subtask's row. */
  onAction: (task: Task, action: string) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const router = useRouter()
  const actions = useTaskActions()
  const [reordering, setReordering] = useState(false)
  const words = t.tasks.subtasks

  const subtasks = subtasksOf(tasks, task.id)
  // A linked list's rows are read here as they are there: nothing to add to.
  if (!list.writable && subtasks.length === 0) return null
  const done = subtasks.filter((each) => each.done).length
  const open = subtasks.filter((each) => !each.done)

  const commit = (ids: string[]) =>
    actions
      // The server takes every subtask once: the checked ones keep their
      // places after the open ones the person arranged.
      .reorderSubtasks(task.id, [
        ...ids,
        ...subtasks.filter((each) => each.done).map((each) => each.id),
      ])
      .catch(() => haptics.actionFailed())

  return (
    <View testID="detail-subtasks" style={styles.section}>
      <SmartHeading
        label={words.title}
        aside={
          subtasks.length > 0
            ? fmt(words.progress, { done, total: subtasks.length })
            : undefined
        }
      />
      {reordering ? (
        <>
          <ReorderMode
            tasks={open}
            display={list.display}
            today={today}
            scrollRef={scrollRef}
            onDragging={onDragging}
            onCommit={commit}
          />
          <Pressable
            testID="subtasks-reorder-done"
            accessibilityRole="button"
            accessibilityLabel={t.actions.done}
            hitSlop={8}
            onPress={() => setReordering(false)}
            style={styles.done}
          >
            <Text style={[styles.doneText, { color: tokens.accentText }]}>
              {t.actions.done}
            </Text>
          </Pressable>
        </>
      ) : (
        <InsetList>
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              writable={list.writable}
              meta={<SubtaskDate task={subtask} today={today} />}
              onOpen={() =>
                router.push({
                  pathname: '/all/tasks/task/[taskId]',
                  params: { taskId: subtask.id, listId: list.id },
                })
              }
              menu={{
                reorder:
                  list.provider === 'local' &&
                  open.length > 1 &&
                  !subtask.done,
                onAction: (action) =>
                  action === 'reorder'
                    ? setReordering(true)
                    : onAction(subtask, action),
              }}
            />
          ))}
          {list.writable ? (
            <TaskComposer
              listId={list.id}
              placeholder={words.add}
              parent={task}
              linked={list.provider !== 'local'}
              onFailed={() => showAlert(words.failed)}
            />
          ) : null}
        </InsetList>
      )}
      {list.provider === 'local' ? (
        <Text style={[styles.hint, { color: tokens.muted }]}>
          {words.footnote}
        </Text>
      ) : null}
    </View>
  )
}

/** A subtask's due date under its title, red once it is late. */
function SubtaskDate({ task, today }: { task: Task; today: string }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  if (!task.dueDate) return null
  const late = !task.done && isOverdue(task.dueDate, today)
  const color = late ? tokens.danger : tokens.muted
  return (
    <View style={styles.meta}>
      <TASK_ICONS.Calendar
        size={12}
        color={color}
        strokeWidth={2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.metaText, { color }]}>
        {dueLabel(task.dueDate, today, locale, {
          today: t.tasks.task.today,
          tomorrow: t.tasks.task.tomorrow,
        })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  hint: { ...TYPE.footnote, paddingHorizontal: 4 },
  done: { alignSelf: 'flex-end', paddingHorizontal: 4, paddingVertical: 6 },
  doneText: { ...TYPE.bodyStrong },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...TYPE.footnote },
})
