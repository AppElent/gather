/**
 * What holding a task offers, and the sheets those offers open.
 *
 * A task appears on three screens — the Today strip, a list, the detail screen
 * — and holding it, or tapping one of its properties, has to mean the same
 * thing on each. So the action list and the sheets it opens live here, once. A
 * screen decides only what its own rows look like and whether Reorder is on
 * the menu — that being the one action a list has and a cross-list strip
 * cannot.
 */
import type { MenuAction } from '@expo/ui/community/menu'
import { localIsoDate } from '@gather/core/civil-date'
import { useIsFocused } from 'expo-router'
import { useEffect, useRef, useState } from 'react'

import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import { useUndoToast } from '../../ui/undo-toast'
import { useCompleteTask } from './completeTask'
import { ReminderSheet } from './ReminderSheet'
import { RepeatSheet } from './RepeatSheet'
import { MoveToSectionSheet } from './sections'
import {
  DueDateSheet,
  LabelsSheet,
  MoveToListSheet,
  MoveUnderSheet,
  PrioritySheet,
  RenameSheet,
} from './sheets'
import { onOccurrenceCompleted, useTaskActions } from './store'
import { dueLabel } from './taskDates'
import type { Task } from './types'
import { useWriteFailed } from './writeFailed'

/**
 * The menu, in the order the detail screen lists the same properties.
 *
 * Messages arrive as a parameter rather than from the context (ADR-0011's
 * third rule), which is what lets this be read without a React tree.
 */
export function taskMenuActions(
  task: Task,
  t: Messages,
  {
    writable,
    reorder,
    sections = false,
  }: {
    writable: boolean
    reorder: boolean
    /** Whether the task's list has sections to move it between (APP-357). */
    sections?: boolean
  },
): MenuAction[] {
  return [
    {
      id: 'complete',
      title: task.done ? t.tasks.list.uncomplete : t.tasks.list.complete,
      image: 'checkmark.circle',
      attributes: { disabled: !writable },
    },
    {
      id: 'rename',
      title: t.tasks.list.renameTask,
      image: 'pencil',
      attributes: { disabled: !writable },
    },
    {
      id: 'due',
      title: t.tasks.list.dueDate,
      image: 'calendar',
      attributes: { disabled: !writable },
    },
    {
      id: 'priority',
      title: t.tasks.list.priority,
      image: 'flag',
      attributes: { disabled: !writable },
    },
    {
      id: 'labels',
      title: t.tasks.list.labels,
      image: 'tag',
      attributes: { disabled: !writable },
    },
    {
      id: 'move',
      title: t.tasks.list.moveToList,
      image: 'tray',
      attributes: { hidden: Boolean(task.linked) },
    },
    {
      id: 'under',
      title: t.tasks.linkedWrite.moveUnder,
      image: 'arrow.turn.down.right',
      // A linked task moves within its list only (APP-448).
      attributes: { disabled: !writable || task.done, hidden: !task.linked },
    },
    {
      id: 'section',
      title: t.tasks.sections.moveToSection,
      image: 'rectangle.split.1x2',
      attributes: { disabled: !writable, hidden: !sections },
    },
    {
      id: 'reorder',
      title: t.actions.reorder,
      image: 'arrow.up.arrow.down',
      // Rearranging belongs to a list. Today is a view across all of them, so
      // there is no order here to be the one you changed.
      attributes: {
        disabled: !writable,
        hidden: !reorder || Boolean(task.linked),
      },
    },
    {
      id: 'delete',
      title: t.common.actions.delete,
      image: 'trash',
      // Gather does not delete a task from its provider.
      attributes: {
        destructive: true,
        disabled: !writable,
        hidden: Boolean(task.linked),
      },
    },
  ]
}

/** The delete confirm's body: a parent's subtasks go with it (APP-304). */
export function deleteMessage(task: Pick<Task, 'subtasks'>, t: Messages) {
  const count = task.subtasks?.total ?? 0
  if (count === 0) return t.tasks.list.deleteBody
  return count === 1
    ? t.tasks.subtasks.deleteBodyOne
    : fmt(t.tasks.subtasks.deleteBody, { count })
}

type TaskSheet =
  | 'due'
  | 'repeat'
  | 'priority'
  | 'labels'
  | 'move'
  | 'under'
  | 'rename'
  | 'reminder'
  | 'section'

/**
 * Runs every action on the menu except Reorder, which the screen owns.
 *
 * Returns the sheets as an element the caller renders last, after its own
 * scroll view — a sheet inside one is a sheet that scrolls away. The same
 * element carries the undo toast for a repeating task completed on this
 * screen, from a row or from the menu (APP-303).
 */
export function useTaskSheets({
  tasks,
  onReorder,
  onDeleted,
}: {
  /**
   * The tasks the screen is showing, as it reads them: an open sheet draws
   * its task from here, so it follows a write the sheet itself made.
   */
  tasks: readonly Task[]
  onReorder?: () => void
  /**
   * For a screen that is about a task, and so has to leave with it. It hears
   * which task went: the detail screen's subtask rows are deleted from here
   * too, and the screen leaves only when its own task goes.
   */
  onDeleted?: (task: Task) => void
}) {
  const { t } = useI18n()
  const actions = useTaskActions()
  const [open, setOpen] = useState<{ kind: TaskSheet; taskId: string } | null>(
    null,
  )
  const completeTask = useCompleteTask()
  const writeFailed = useWriteFailed()
  const close = () => setOpen(null)
  const task = open && tasks.find((each) => each.id === open.taskId)

  const confirmDelete = (task: Task) =>
    confirmDestructive({
      title: fmt(t.tasks.list.deleteTitle, { title: task.title }),
      message: deleteMessage(task, t),
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => {
        actions.deleteTask(task.id)
        onDeleted?.(task)
      },
    })

  const onAction = (task: Task, action: string) => {
    switch (action) {
      case 'complete':
        completeTask(task)
        break
      case 'rename':
      case 'due':
      case 'repeat':
      case 'priority':
      case 'labels':
      case 'move':
      case 'under':
      case 'reminder':
      case 'section':
        setOpen({ kind: action, taskId: task.id })
        break
      case 'reorder':
        onReorder?.()
        break
      case 'delete':
        confirmDelete(task)
        break
    }
  }

  const undoToast = useCompletionUndo()

  const sheets = !open || !task ? (
    undoToast
  ) : (
    <>
      {open.kind === 'due' ? <DueDateSheet task={task} onClose={close} /> : null}
      {open.kind === 'repeat' ? (
        <RepeatSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'priority' ? (
        <PrioritySheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'labels' ? (
        <LabelsSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'move' ? (
        <MoveToListSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'under' ? (
        <MoveUnderSheet task={task} tasks={tasks} onClose={close} />
      ) : null}
      {open.kind === 'reminder' ? (
        <ReminderSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'section' ? (
        <MoveToSectionSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'rename' ? (
        <RenameSheet
          title={t.tasks.list.renameTask}
          value={task.title}
          place={`tasks:rename-task:${task.id}`}
          onSave={(next) => {
            actions.renameTask(task, next).catch(writeFailed)
          }}
          onClose={close}
        />
      ) : null}
      {undoToast}
    </>
  )

  return { onAction, sheets }
}

/**
 * "Done. Next: Sat 28 Nov · Undo" after a repeating task is completed. Only
 * the screen in front shows it: a tab behind it also holds task sheets, and
 * one completion is one toast.
 */
function useCompletionUndo() {
  const { t, locale } = useI18n()
  const actions = useTaskActions()
  const focused = useIsFocused()
  const { show, toast } = useUndoToast()
  const words = t.tasks.repeat
  // The actions are new on every render; read the latest from a ref so the
  // listener is not dropped and re-added each time, missing a completion in
  // between.
  const undoCompletion = useRef(actions.undoCompletion)
  undoCompletion.current = actions.undoCompletion

  useEffect(() => {
    if (!focused) return
    return onOccurrenceCompleted((done) => {
      show({
        message: fmt(words.completed, {
          date: dueLabel(done.dueDate, localIsoDate(), locale, {
            today: t.tasks.task.today,
            tomorrow: t.tasks.task.tomorrow,
          }),
        }),
        undo: {
          label: words.undo,
          onPress: () => {
            undoCompletion.current(done.completionId).catch(() => {
              haptics.actionFailed()
              show({ message: words.undoFailed })
            })
          },
        },
      })
    })
  }, [focused, show, words, locale, t])

  return toast
}
