/**
 * What holding a task offers, and the sheets those offers open.
 *
 * A task appears on three screens â€” the Today strip, a list, the detail screen
 * â€” and holding it has to mean the same thing on each. It did not: Today's
 * rows were built as a digest and quietly grew up into rows, keeping the shape
 * of the list's rows without any of their gestures. Nothing catches that,
 * because a row with no menu renders perfectly well.
 *
 * So the action list and the sheets it opens live here, once. A screen decides
 * only what its own rows look like and whether Reorder is on the menu â€” that
 * being the one action a list has and a cross-list strip cannot.
 */
import type { MenuAction } from '@expo/ui/community/menu'
import { useState } from 'react'
import { Alert } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import {
  DueDateSheet,
  LabelsSheet,
  MoveToListSheet,
  PrioritySheet,
  RenameSheet,
} from './sheets'
import { taskActions, useTaskState } from './store'
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
      title: task.done ? t.labs.list.uncomplete : t.labs.list.complete,
      image: 'checkmark.circle',
      attributes: { disabled: !writable },
    },
    {
      id: 'rename',
      title: t.labs.list.renameTask,
      image: 'pencil',
      attributes: { disabled: !writable },
    },
    { id: 'due', title: t.labs.list.dueDate, image: 'calendar' },
    { id: 'priority', title: t.labs.list.priority, image: 'flag' },
    { id: 'labels', title: t.labs.list.labels, image: 'tag' },
    { id: 'move', title: t.labs.list.moveToList, image: 'tray' },
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
      title: t.actions.delete,
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
 * scroll view â€” a sheet inside one is a sheet that scrolls away.
 */
export function useTaskSheets(onReorder?: () => void) {
  const { t } = useI18n()
  const state = useTaskState()
  const [open, setOpen] = useState<{ kind: TaskSheet; taskId: string } | null>(
    null,
  )
  const close = () => setOpen(null)

  const confirmDelete = (task: Task) =>
    Alert.alert(
      fmt(t.labs.list.deleteTitle, { title: task.title }),
      t.labs.list.deleteBody,
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.actions.delete,
          style: 'destructive',
          onPress: () => taskActions.deleteTask(task.id),
        },
      ],
    )

  const onAction = (task: Task, action: string) => {
    switch (action) {
      case 'complete':
        taskActions.toggleTask(task.id)
        haptics.itemCompleted()
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

  const sheets = !open ? null : (
    <>
      {open.kind === 'due' ? (
        <DueDateSheet taskId={open.taskId} onClose={close} />
      ) : null}
      {open.kind === 'priority' ? (
        <PrioritySheet taskId={open.taskId} onClose={close} />
      ) : null}
      {open.kind === 'labels' ? (
        <LabelsSheet taskId={open.taskId} onClose={close} />
      ) : null}
      {open.kind === 'move' ? (
        <MoveToListSheet taskId={open.taskId} onClose={close} />
      ) : null}
      {open.kind === 'rename' ? (
        <RenameSheet
          title={t.labs.list.renameTask}
          value={
            state.tasks.find((each) => each.id === open.taskId)?.title ?? ''
          }
          onSave={(next) => taskActions.renameTask(open.taskId, next)}
          onClose={close}
        />
      ) : null}
    </>
  )

  return { onAction, sheets, confirmDelete }
}
