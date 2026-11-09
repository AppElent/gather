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
import { useState } from 'react'

import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import {
  DueDateSheet,
  LabelsSheet,
  MoveToListSheet,
  PrioritySheet,
  RenameSheet,
} from './sheets'
import { useTaskActions } from './store'
import type { Task } from './types'

/**
 * The menu, in the order the detail screen lists the same properties.
 *
 * Messages arrive as a parameter rather than from the context (ADR-0011's
 * third rule), which is what lets this be read without a React tree.
 */
export function taskMenuActions(
  task: Task,
  t: Messages,
  { writable, reorder }: { writable: boolean; reorder: boolean },
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
    { id: 'due', title: t.tasks.list.dueDate, image: 'calendar' },
    { id: 'priority', title: t.tasks.list.priority, image: 'flag' },
    { id: 'labels', title: t.tasks.list.labels, image: 'tag' },
    { id: 'move', title: t.tasks.list.moveToList, image: 'tray' },
    {
      id: 'reorder',
      title: t.actions.reorder,
      image: 'arrow.up.arrow.down',
      // Rearranging belongs to a list. Today is a view across all of them, so
      // there is no order here to be the one you changed.
      attributes: { disabled: !writable, hidden: !reorder },
    },
    {
      id: 'delete',
      title: t.common.actions.delete,
      image: 'trash',
      attributes: { destructive: true },
    },
  ]
}

type TaskSheet = 'due' | 'priority' | 'labels' | 'move' | 'rename'

/**
 * Runs every action on the menu except Reorder, which the screen owns.
 *
 * Returns the sheets as an element the caller renders last, after its own
 * scroll view — a sheet inside one is a sheet that scrolls away.
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
  /** For a screen that is about the task, and so has to leave with it. */
  onDeleted?: () => void
}) {
  const { t } = useI18n()
  const actions = useTaskActions()
  const [open, setOpen] = useState<{ kind: TaskSheet; taskId: string } | null>(
    null,
  )
  const close = () => setOpen(null)
  const task = open && tasks.find((each) => each.id === open.taskId)

  const confirmDelete = (task: Task) =>
    confirmDestructive({
      title: fmt(t.tasks.list.deleteTitle, { title: task.title }),
      message: t.tasks.list.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => {
        actions.deleteTask(task.id)
        onDeleted?.()
      },
    })

  const onAction = (task: Task, action: string) => {
    switch (action) {
      case 'complete':
        if (!task.done) haptics.itemCompleted()
        actions.toggleTask(task.id).catch(() => haptics.actionFailed())
        break
      case 'rename':
      case 'due':
      case 'priority':
      case 'labels':
      case 'move':
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

  const sheets = !open || !task ? null : (
    <>
      {open.kind === 'due' ? <DueDateSheet task={task} onClose={close} /> : null}
      {open.kind === 'priority' ? (
        <PrioritySheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'labels' ? (
        <LabelsSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'move' ? (
        <MoveToListSheet task={task} onClose={close} />
      ) : null}
      {open.kind === 'rename' ? (
        <RenameSheet
          title={t.tasks.list.renameTask}
          value={task.title}
          onSave={(next) => actions.renameTask(task.id, next)}
          onClose={close}
        />
      ) : null}
    </>
  )

  return { onAction, sheets }
}
