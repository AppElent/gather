/**
 * Ticking a task, wherever it is ticked: the box, a swipe, the hold menu, or
 * the detail screen's own box. One place, so all four ask the same question.
 *
 * A task with open subtasks asks first (APP-304, `designs/tasks` §4): "Complete
 * all" checks the open subtasks with it, "Only this" leaves them open, Cancel
 * changes nothing. A repeating task does not ask: its subtasks reopen with the
 * next occurrence whichever is chosen (`asksAboutSubtasks`).
 */
import { asksAboutSubtasks } from '@gather/core/subtasks'

import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import { showAlert } from '../../observability/native-presentation'
import { useTaskActions } from './store'
import type { Task } from './types'

/**
 * The alert, apart from React so it can be tested: it calls `run` with the
 * choice, or nothing on Cancel.
 */
export function askCompleteSubtasks(
  task: Pick<Task, 'title' | 'subtasks'>,
  t: Messages,
  run: (withSubtasks: boolean) => void,
) {
  const words = t.tasks.subtasks
  const open = (task.subtasks?.total ?? 0) - (task.subtasks?.done ?? 0)
  showAlert(
    words.askTitle,
    fmt(open === 1 ? words.askBodyOne : words.askBody, {
      title: task.title,
      count: open,
    }),
    [
      { text: words.completeAll, onPress: () => run(true) },
      { text: words.onlyThis, onPress: () => run(false) },
      { text: t.common.actions.cancel, style: 'cancel' },
    ],
  )
}

export function useCompleteTask() {
  const { t } = useI18n()
  const actions = useTaskActions()
  /** Ticks or unticks `task`; `onResult` hears whether the server took it. */
  return (task: Task, onResult?: (ok: boolean) => void) => {
    const run = (withSubtasks: boolean) => {
      if (!task.done) haptics.itemCompleted()
      actions.toggleTask(task, { withSubtasks }).then(
        () => onResult?.(true),
        () => {
          haptics.actionFailed()
          onResult?.(false)
        },
      )
    }
    if (asksAboutSubtasks(task, task.subtasks)) {
      askCompleteSubtasks(task, t, run)
    } else {
      run(false)
    }
  }
}
