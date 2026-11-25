/** How Tasks says things on the web: the phone's words, as rows and fields. */
import { addDays, daysBetween, localMidnight } from '@gather/core/civil-date'
import { LinkedWriteError } from '@gather/core/linked-lists'
import type { Messages } from '@gather/core/messages'
import { dueLabel } from '@gather/core/task-dates'
import { keepsCheckedInPlace } from '@gather/core/task-lists'
import type { ListCount, Task, TaskList } from '@gather/core/task-model'
import { describeRepeat } from '@gather/core/task-repeat'
import { fmt } from '../../lib/i18n'
import { PROVIDER_LABELS } from '../../lib/oauth'

export function providerName(provider: TaskList['provider']): string {
  return provider === 'local' ? '' : PROVIDER_LABELS[provider]
}

/** "today", "tomorrow", a near weekday, or the date. */
export function dayWords(due: string, today: string, locale: string, t: Messages) {
  return dueLabel(due, today, locale, {
    today: t.tasks.task.today,
    tomorrow: t.tasks.task.tomorrow,
  })
}

/** `dayWords` with "yesterday", for a smart list's late rows. */
export function relativeDay(
  due: string,
  today: string,
  locale: string,
  t: Messages,
): string {
  if (daysBetween(today, due) === -1) return t.tasks.smart.yesterday
  return dayWords(due, today, locale, t)
}

export function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1)
}

/** "Today · Wednesday 18 November", "Tomorrow · …", or the day itself. */
export function dayHeading(
  date: string,
  today: string,
  locale: string,
  t: Messages,
): string {
  const full = localMidnight(date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (date === today) return fmt(t.tasks.smart.days.today, { date: full })
  if (date === addDays(today, 1)) {
    return fmt(t.tasks.smart.days.tomorrow, { date: full })
  }
  return upperFirst(full)
}

/** How a task repeats, in our words or its provider's; '' when it does not. */
export function repeatWords(
  task: Pick<Task, 'repeat' | 'repeatText'>,
  locale: string,
  t: Messages,
): string {
  return task.repeat
    ? describeRepeat(task.repeat, t.tasks.repeat.summary, locale)
    : (task.repeatText ?? '')
}

/** How many tasks are left on a list; '' until the count is known. */
export function openCountWords(
  list: TaskList,
  count: ListCount | undefined,
  t: Messages,
): string {
  const words = t.tasks.index
  if (list.sync === 'reconnect' || list.sync === 'failed')
    return words.notLoaded
  if (!count) return ''
  // A packing list is ticked off and reset, so it counts what is packed.
  if (keepsCheckedInPlace(list.kind)) {
    return fmt(t.tasks.packing.progress, {
      done: count.done ?? 0,
      total: count.total ?? count.open,
    })
  }
  if (count.open === 0) return words.allDone
  if (count.open === 1) return words.openOne
  return fmt(words.open, { count: count.open })
}

/** What to say about a write that failed; a linked one says why (APP-448). */
export function failureWords(
  error: unknown,
  lists: readonly { _id: string; provider: TaskList['provider'] }[] | undefined,
  t: Messages,
): string | null {
  if (!(error instanceof LinkedWriteError)) return null
  const provider = providerName(
    lists?.find((list) => list._id === error.listId)?.provider ?? 'todoist',
  )
  return `${fmt(t.tasks.linkedWrite.failedTitle, { provider })}. ${fmt(
    t.tasks.linkedWrite.failed[error.reason],
    { provider },
  )}`
}

/** The delete confirm's body: a parent's subtasks go with it (APP-304). */
export function deleteBody(task: Pick<Task, 'subtasks'>, t: Messages) {
  const count = task.subtasks?.total ?? 0
  if (count === 0) return undefined
  return count === 1
    ? t.tasks.subtasks.deleteBodyOne
    : fmt(t.tasks.subtasks.deleteBody, { count })
}
