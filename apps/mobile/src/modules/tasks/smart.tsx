/**
 * The pieces every smart list draws with (APP-301): a task row that names the
 * list it came from, and a section heading with a count beside it.
 *
 * A smart row is a `TaskRow` like any other: the box ticks, the row opens,
 * swipe right completes, swipe left deletes, and holding offers the same menu
 * as inside a list without Reorder, which belongs to a list. What it adds is
 * the source list's name, because a row lifted out of its list has lost the
 * one thing its list said about it.
 */
import { daysBetween } from '@gather/core/civil-date'
import { describeRepeat } from '@gather/core/task-repeat'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { fmt, type Messages, useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { SectionLabel } from '../../ui/section-label'
import { TASK_ICONS } from './icons'
import { TaskRow } from './TaskRow'
import { dueLabel, isOverdue } from './taskDates'
import type { Task, TaskList } from './types'

/**
 * Which date a smart row names:
 * - `late`: only a missed one, as "Overdue · yesterday" (Today, where every
 *   other row is due today anyway);
 * - `any`: whichever it has (Mine and Unassigned, which are not by date);
 * - `past`: the missed day alone, as "Yesterday" (Upcoming's Overdue group,
 *   whose heading already says it is late);
 * - `none`: no date (Upcoming's day groups, whose heading is the date).
 */
export type SmartDate = 'late' | 'any' | 'past' | 'none'

export function SmartTaskRow({
  task,
  list,
  today,
  date,
  onAction,
}: {
  task: Task
  /** Its own list; absent only for a moment while the lists load. */
  list: TaskList | undefined
  today: string
  date: SmartDate
  onAction: (task: Task, action: string) => void
}) {
  const router = useRouter()
  return (
    <TaskRow
      task={task}
      writable={list?.writable ?? false}
      chevron
      meta={
        <SmartMeta task={task} listName={list?.name} today={today} date={date} />
      }
      onOpen={() =>
        router.push({
          pathname: '/all/tasks/task/[taskId]',
          params: { taskId: task.id, listId: task.listId },
        })
      }
      menu={{ reorder: false, onAction: (action) => onAction(task, action) }}
    />
  )
}

/** The repeat glyph, the date when it says something, and the list's name. */
function SmartMeta({
  task,
  listName,
  today,
  date,
}: {
  task: Task
  listName: string | undefined
  today: string
  date: SmartDate
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const late = Boolean(task.dueDate && isOverdue(task.dueDate, today))
  const day = task.dueDate ? relativeDay(task.dueDate, today, locale, t) : null

  let when: string | null = null
  if (day && late && (date === 'late' || date === 'any')) {
    when = `${t.tasks.smart.overdue} · ${day}`
  } else if (day && late && date === 'past') {
    when = upperFirst(day)
  } else if (day && date === 'any') {
    when = day
  }
  const repeats = Boolean(task.repeat || task.repeatText)
  // After the list: a parent's progress, or the parent a subtask is a step
  // of, since its row is here without it (APP-304).
  const progress = task.subtasks
    ? fmt(t.tasks.subtasks.progress, { ...task.subtasks })
    : null
  const where = [listName, task.parentTitle ?? progress]
    .filter(Boolean)
    .join(' · ')
  const spokenWhere = [
    listName,
    task.parentTitle
      ? fmt(t.tasks.subtasks.stepOf, { title: task.parentTitle })
      : progress,
  ]
    .filter(Boolean)
    .join(', ')
  const text = [when, spokenWhere].filter(Boolean).join(', ')
  const spokenRepeat = task.repeat
    ? describeRepeat(task.repeat, t.tasks.repeat.summary, locale)
    : task.repeatText

  return (
    <View
      style={styles.meta}
      accessible
      accessibilityLabel={[spokenRepeat, text].filter(Boolean).join(', ')}
    >
      {repeats ? (
        <TASK_ICONS.Repeat
          size={12}
          color={tokens.muted}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      {when ? (
        <Text
          style={[
            styles.metaText,
            late ? styles.late : null,
            { color: late ? tokens.danger : tokens.muted },
          ]}
        >
          {when}
          {where ? (
            <Text style={[styles.list, { color: tokens.muted }]}>
              {` · ${where}`}
            </Text>
          ) : null}
        </Text>
      ) : where ? (
        <Text style={[styles.metaText, { color: tokens.muted }]}>{where}</Text>
      ) : null}
    </View>
  )
}

/** A section heading with a count at its end, red when it counts late tasks. */
export function SmartHeading({
  label,
  aside,
  danger = false,
}: {
  label: string
  aside?: string
  danger?: boolean
}) {
  const tokens = useTokens('home')
  return (
    <View accessible accessibilityRole="header" style={styles.heading}>
      <SectionLabel>{label}</SectionLabel>
      {aside ? (
        <Text
          style={[
            styles.aside,
            { color: danger ? tokens.danger : tokens.muted },
          ]}
        >
          {aside}
        </Text>
      ) : null}
    </View>
  )
}

/** A line in place of rows, when a smart list has none. */
export function SmartEmpty({ text }: { text: string }) {
  const tokens = useTokens('home')
  return (
    <View style={styles.emptyRow}>
      <Text style={[styles.empty, { color: tokens.muted }]}>{text}</Text>
    </View>
  )
}

/** "yesterday", "Today", "Thu", or a date: how near a due date is. */
function relativeDay(
  due: string,
  today: string,
  locale: string,
  t: Messages,
): string {
  if (daysBetween(today, due) === -1) return t.tasks.smart.yesterday
  return dueLabel(due, today, locale, {
    today: t.tasks.task.today,
    tomorrow: t.tasks.task.tomorrow,
  })
}

export function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...TYPE.footnote, flexShrink: 1 },
  /** Late is said in `danger` 600, the rest of the line stays as it was. */
  late: { ...TYPE.footnoteStrong },
  list: { ...TYPE.footnote },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  aside: { ...TYPE.footnoteStrong },
  emptyRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  empty: { ...TYPE.subhead },
})
