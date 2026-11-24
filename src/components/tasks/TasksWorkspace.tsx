/**
 * What every Tasks page shares (APP-308): the writes, the question about open subtasks, and the
 * dialogs a task's `⋯` menu opens. A task means the same thing on the index,
 * in a list, in a smart list and in its panel, so it is all here, once.
 */
import { localIsoDate } from '@gather/core/civil-date'
import { externalSnapshot } from '@gather/core/linked-lists'
import { possibleParents } from '@gather/core/linked-tasks'
import { asksAboutSubtasks } from '@gather/core/subtasks'
import type { Task, TaskList } from '@gather/core/task-model'
import { createContext, type ReactNode, useContext, useState } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { buttonClass } from '../app/buttons'
import { useConfirmAction } from '../app/ConfirmAction'
import { Dialog } from '../app/Dialog'
import type { RowMenuAction } from '../app/RowMenu'
import { ChoiceList } from './ChoiceList'
import { useTaskLists } from './data'
import { type Notice, useTasksNotices } from './TasksNotices'
import { type TaskActions, useTaskActions } from './useTaskActions'
import { dayWords, deleteBody, providerName } from './words'

type TaskDialog =
  | { kind: 'move' | 'section'; task: Task; list: TaskList }
  | { kind: 'under'; task: Task }
  | { kind: 'complete'; task: Task }

interface MenuContext {
  task: Task
  list: TaskList
  /** Where in its group it may go, when its place is the list's to give. */
  onMove?: { up?: () => void; down?: () => void }
  onOpen?: () => void
  /** The task was deleted: a page or panel about it leaves. */
  onDeleted?: () => void
}

interface Workspace {
  actions: TaskActions
  show: (notice: Notice) => void
  /** Says why a write did not go through. */
  fail: (error: unknown, fallback?: string) => void
  /** Ticks or unticks a task, asking about its open subtasks first. */
  complete: (task: Task) => void
  /** The `⋯` menu's actions, in one order on every page. */
  menu: (context: MenuContext) => RowMenuAction[]
  confirm: ReturnType<typeof useConfirmAction>['confirm']
}

const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Tasks workspace is missing')
  return workspace
}

export function TasksWorkspace({ children }: { children: ReactNode }) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web
  const actions = useTaskActions()
  const lists = useTaskLists()
  const { confirm, dialog: confirmDialog } = useConfirmAction()
  const { show, fail } = useTasksNotices()
  const [dialog, setDialog] = useState<TaskDialog | null>(null)
  const close = () => setDialog(null)

  const run = (task: Task, withSubtasks: boolean) => {
    actions.toggleTask(task, { withSubtasks }).then((done) => {
      // A repeating task stays open with its next date; say which one it is.
      if (!done) return
      show({
        message: fmt(t.tasks.repeat.completed, {
          date: dayWords(done.dueDate, localIsoDate(), locale, t),
        }),
        undo: () => {
          actions
            .undoCompletion(done.completionId)
            .catch((error) => fail(error, t.tasks.repeat.undoFailed))
        },
      })
    }, fail)
  }

  const complete = (task: Task) => {
    if (task.pending) return
    if (asksAboutSubtasks(task, task.subtasks)) {
      setDialog({ kind: 'complete', task })
    } else run(task, false)
  }

  const menu = ({
    task,
    list,
    onMove,
    onOpen,
    onDeleted,
  }: MenuContext): RowMenuAction[] => {
    const local = list.provider === 'local'
    const items: RowMenuAction[] = []
    const add = (id: string, label: string, onSelect: () => void) =>
      items.push({ id, label, onSelect })
    if (onOpen) add('open', words.menu.open, onOpen)
    if (onMove?.up) add('up', words.menu.moveUp, onMove.up)
    if (onMove?.down) add('down', words.menu.moveDown, onMove.down)
    if (list.writable && local && !list.grocery) {
      // A subtask stays with its parent (APP-304).
      if (!task.parentTaskId) {
        add('move', words.menu.move, () =>
          setDialog({ kind: 'move', task, list }),
        )
        if (list.sections.length > 0) {
          add('section', words.menu.section, () =>
            setDialog({ kind: 'section', task, list }),
          )
        }
        add('duplicate', words.menu.duplicate, () => {
          actions
            .duplicate(
              task,
              fmt(words.duplicateTitle, { title: task.title }),
              crypto.randomUUID(),
            )
            .then(() => show({ message: words.duplicated }), fail)
        })
      }
    }
    if (!local && list.writable && !task.done) {
      add('under', t.tasks.linkedWrite.moveUnder, () =>
        setDialog({ kind: 'under', task }),
      )
    }
    if (task.sourceUrl) {
      add(
        'source',
        fmt(words.menu.openSource, { provider: providerName(list.provider) }),
        () => window.open(task.sourceUrl, '_blank', 'noopener,noreferrer'),
      )
    }
    if (list.writable && local) {
      items.push({
        id: 'delete',
        label: words.menu.delete,
        danger: true,
        onSelect: () =>
          confirm({
            title: fmt(words.deleteTitle, { title: task.title }),
            body: deleteBody(task, t) ?? words.deleteBody,
            confirmLabel: t.common.actions.delete,
            errorFallback: words.failed,
            run: async () => {
              await actions.remove(task.id)
              onDeleted?.()
              show({ message: fmt(words.deleted, { title: task.title }) })
            },
          }),
      })
    }
    return items
  }

  const choose = (work: () => Promise<unknown>, done?: string) => {
    close()
    work().then(() => {
      if (done) show({ message: done })
    }, fail)
  }

  return (
    <WorkspaceContext
      value={{ actions, show, fail, complete, menu, confirm }}
    >
      {children}

      {dialog?.kind === 'complete' ? (
        <CompleteDialog
          task={dialog.task}
          onClose={close}
          onChoose={(withSubtasks) => {
            close()
            run(dialog.task, withSubtasks)
          }}
        />
      ) : null}

      {dialog?.kind === 'move' ? (
        <ChoiceDialog
          title={words.menu.move}
          current={dialog.task.listId}
          options={(lists ?? [])
            .filter(
              (list) =>
                list.provider === 'local' &&
                list.writable &&
                (!list.grocery || list._id === dialog.task.listId),
            )
            .map((list) => ({ id: list._id as string, label: list.name }))}
          onClose={close}
          onChoose={(listId) => {
            if (listId === null) return
            choose(
              () => actions.moveToList(dialog.task.id, listId),
              fmt(words.moved, {
                list: lists?.find((list) => list._id === listId)?.name ?? '',
              }),
            )
          }}
        />
      ) : null}

      {dialog?.kind === 'section' ? (
        <ChoiceDialog
          title={t.tasks.sections.moveToSection}
          current={dialog.task.sectionId ?? null}
          options={[
            { id: null, label: t.tasks.sections.none },
            ...dialog.list.sections.map((section) => ({
              id: section.id,
              label: section.name,
            })),
          ]}
          onClose={close}
          onChoose={(id) =>
            choose(() => actions.setTaskSection(dialog.task.id, id))
          }
        />
      ) : null}

      {dialog?.kind === 'under' ? (
        <UnderDialog
          task={dialog.task}
          onClose={close}
          onChoose={(id) => choose(() => actions.moveUnder(dialog.task, id))}
        />
      ) : null}

      {confirmDialog}
    </WorkspaceContext>
  )
}

function CompleteDialog({
  task,
  onClose,
  onChoose,
}: {
  task: Task
  onClose: () => void
  onChoose: (withSubtasks: boolean) => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.subtasks
  const open = (task.subtasks?.total ?? 0) - (task.subtasks?.done ?? 0)
  return (
    <Dialog
      title={words.askTitle}
      role="alertdialog"
      closeButton={false}
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass.secondary}
          >
            {t.common.actions.cancel}
          </button>
          {/* Todoist completes a task's subtasks with it, unless the task
              repeats and so stays open (APP-448). */}
          {task.linked && !task.repeatText ? null : (
            <button
              type="button"
              onClick={() => onChoose(false)}
              className={buttonClass.secondary}
            >
              {words.onlyThis}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChoose(true)}
            className={buttonClass.primary}
          >
            {words.completeAll}
          </button>
        </>
      }
    >
      <p className="m-0 text-subhead text-[var(--muted)]">
        {fmt(open === 1 ? words.askBodyOne : words.askBody, {
          title: task.title,
          count: open,
        })}
      </p>
    </Dialog>
  )
}

function UnderDialog({
  task,
  onClose,
  onChoose,
}: {
  task: Task
  onClose: () => void
  onChoose: (id: string | null) => void
}) {
  const { messages: t } = useI18n()
  const words = t.tasks.linkedWrite
  const parents = possibleParents(
    // The whole of its own list, whatever the page it was opened on shows.
    (externalSnapshot().get(task.listId)?.tasks ?? []).map((each) => ({
      ...each,
      externalId: each.id,
      parentExternalId: each.parentTaskId,
    })),
    task.id,
  )
  const options: { id: string | null; label: string }[] = [
    ...(task.parentTaskId ? [{ id: null, label: words.topLevel }] : []),
    ...parents.map((each) => ({ id: each.id, label: each.title })),
  ]
  return (
    <ChoiceDialog
      title={words.parentTask}
      current={task.parentTaskId ?? null}
      options={options}
      empty={words.noParents}
      onClose={onClose}
      onChoose={onChoose}
    />
  )
}

/** One choice out of a short list, taken at once. */
function ChoiceDialog({
  title,
  options,
  current,
  empty,
  onClose,
  onChoose,
}: {
  title: string
  options: readonly { id: string | null; label: string }[]
  current: string | null
  empty?: string
  onClose: () => void
  onChoose: (id: string | null) => void
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      {options.length === 0 && empty ? (
        <p className="m-0 text-subhead text-[var(--muted)]">{empty}</p>
      ) : (
        <ChoiceList
          label={title}
          options={options}
          current={current}
          onChoose={(id) => (id === current ? onClose() : onChoose(id))}
        />
      )}
    </Dialog>
  )
}
