import { isOverdue } from '@gather/core/task-dates'
import { hasLinkAndPrice } from '@gather/core/task-lists'
import type { Task, TaskList } from '@gather/core/task-model'
import { formatPrice } from '@gather/core/wishlist'
import type { ReactNode } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import type { AppLink } from '../../lib/links'
import { rowDate } from '../../lib/rowDate'
import { InsetRow } from '../app/InsetList'
import { RowMenu, type RowMenuAction } from '../app/RowMenu'
import { CheckRing } from './CheckRing'
import type { TaskPerson } from './data'
import { Coin } from './ListTile'
import { useWorkspace } from './TasksWorkspace'
import { relativeDay, repeatWords, upperFirst } from './words'

/**
 * Which date a smart row names: `late` only a missed one, `any` whichever it
 * has, `past` the missed day alone, `none` no date at all (its heading is it).
 */
export type SmartDate = 'late' | 'any' | 'past' | 'none'

/** A task as a list draws it: ring, title, a footnote, progress, coin, `⋯`. */
export function TaskListRow({
  task,
  list,
  today,
  link,
  selected = false,
  people,
  menu,
  smart,
}: {
  task: Task
  /** Its own list; absent only for a moment while the lists load. */
  list: TaskList | undefined
  today: string
  link: AppLink
  selected?: boolean
  people: ReadonlyMap<string, TaskPerson>
  menu: readonly RowMenuAction[]
  /** Set on a smart list's row, which names the list it came from. */
  smart?: SmartDate
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web
  const { complete } = useWorkspace()
  const assignee = task.assigneeId ? people.get(task.assigneeId) : undefined
  const progress = task.subtasks

  return (
    <InsetRow
      link={link}
      chevron={false}
      selected={selected}
      title={
        <span
          className={
            task.done
              ? 'text-[var(--muted)] line-through'
              : selected
                ? 'font-semibold'
                : ''
          }
        >
          {task.title}
        </span>
      }
      footnote={
        smart ? (
          <SmartFootnote
            task={task}
            listName={list?.name}
            today={today}
            date={smart}
          />
        ) : (
          footnoteOf(task, list, today, locale, t)
        )
      }
      leading={
        <CheckRing
          label={fmt(task.done ? words.ring.reopen : words.ring.complete, {
            task: task.title,
          })}
          checked={task.done}
          disabled={!list?.writable || task.pending}
          onToggle={() => complete(task)}
        />
      }
      trailing={
        progress || task.assigneeId ? (
          <>
            {progress && !smart ? (
              <span className="text-footnote">
                <span aria-hidden="true">{`${progress.done}/${progress.total}`}</span>
                <span className="sr-only">
                  {fmt(words.row.subtasks, { ...progress })}
                </span>
              </span>
            ) : null}
            {task.assigneeId ? (
              <Coin
                initial={assignee?.initial ?? '?'}
                label={fmt(words.row.assignee, {
                  name: assignee?.name ?? t.tasks.assignee.someone,
                })}
              />
            ) : null}
          </>
        ) : undefined
      }
      menu={
        menu.length > 0 ? (
          <RowMenu item={task.title} actions={menu} />
        ) : undefined
      }
    />
  )
}

/** Date, repeat, priority, labels, price: what the list shows on its rows. */
function footnoteOf(
  task: Task,
  list: TaskList | undefined,
  today: string,
  locale: string,
  t: ReturnType<typeof useI18n>['messages'],
): ReactNode {
  const parts: { key: string; node: ReactNode }[] = []
  if (task.dueDate && (list?.display.due ?? true)) {
    const date = rowDate(task.dueDate, today, locale, t.common.overdueOn)
    const late = date.overdue && !task.done
    parts.push({
      key: 'date',
      node: late ? (
        <span className="font-semibold text-[var(--danger)]">{date.text}</span>
      ) : (
        date.text
      ),
    })
  }
  const repeat = repeatWords(task, locale, t)
  if (repeat) parts.push({ key: 'repeat', node: repeat })
  if (task.priority && list?.display.priority) {
    parts.push({
      key: 'priority',
      node: (
        <span
          className={
            task.priority === 1 ? 'font-semibold text-[var(--danger)]' : ''
          }
        >
          {t.tasks.task.priorities[task.priority]}
        </span>
      ),
    })
  }
  if (task.labels.length > 0 && list?.display.labels) {
    parts.push({
      key: 'labels',
      node: task.labels.map((label) => `#${label}`).join(' '),
    })
  }
  if (list && hasLinkAndPrice(list.kind) && task.priceCents !== undefined) {
    parts.push({ key: 'price', node: formatPrice(task.priceCents, locale) })
  }
  if (parts.length === 0) return undefined
  return parts.map((part, index) => (
    <span key={part.key}>
      {index > 0 ? ' · ' : ''}
      {part.node}
    </span>
  ))
}

function SmartFootnote({
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
  const { locale, messages: t } = useI18n()
  const late = Boolean(task.dueDate && isOverdue(task.dueDate, today))
  const day = task.dueDate ? relativeDay(task.dueDate, today, locale, t) : null
  let when: string | null = null
  if (day && late && (date === 'late' || date === 'any')) {
    when = `${t.tasks.smart.overdue} · ${day}`
  } else if (day && late && date === 'past') {
    when = upperFirst(day)
  } else if (day && date === 'any') {
    when = upperFirst(day)
  }
  const step = task.parentTitle
    ? fmt(t.tasks.subtasks.stepOf, { title: task.parentTitle })
    : task.subtasks
      ? fmt(t.tasks.subtasks.progress, { ...task.subtasks })
      : null
  const rest = [repeatWords(task, locale, t), listName, step]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      {when ? (
        <span
          className={late ? 'font-semibold text-[var(--danger)]' : undefined}
        >
          {when}
        </span>
      ) : null}
      {when && rest ? ' · ' : ''}
      {rest}
    </>
  )
}
