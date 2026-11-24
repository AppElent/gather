import { asksAboutSubtasks, subtaskProgress } from '@gather/core/subtasks'
import { useMutation, useQuery } from 'convex/react'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { QuickAddForm } from './QuickAddForm'
import { TaskEditor, type TaskEditorValues } from './TaskEditor'
import { TaskRow } from './TaskRow'

const iconButtonClass =
  'inline-flex items-center text-[var(--muted)] disabled:opacity-30'

export interface LocalTaskListProps {
  listId: Id<'taskLists'>
  /** The Group the list lives in — every read and write is asked of it. */
  groupSlug: string
  name: string
  onRemoveList: () => void
}

export function LocalTaskList({
  listId,
  groupSlug,
  name,
  onRemoveList,
}: LocalTaskListProps) {
  const tasks = useQuery(api.tasks.listByList, { listId, groupSlug })
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const move = useMutation(api.tasks.move)
  const [showDetails, setShowDetails] = useState(false)
  const [editingId, setEditingId] = useState<Id<'tasks'> | null>(null)
  const messages = useMessages()
  const { local, subtasks: subtaskWords } = messages.tasks
  const { confirm, dialog } = useConfirmAction()
  const progress = subtaskProgress(
    (tasks ?? []).map((t) => ({ ...t, id: t._id })),
  )

  /** Ticks a task, asking about its open subtasks as the phone does (APP-820). */
  function toggle(task: NonNullable<typeof tasks>[number]) {
    const counts = progress.get(task._id)
    const run = (withSubtasks: boolean) =>
      toggleDone({
        taskId: task._id,
        groupSlug,
        ...(withSubtasks ? { withSubtasks: true } : {}),
      })
    if (!counts || !asksAboutSubtasks(task, counts)) {
      void run(false)
      return
    }
    const open = counts.total - counts.done
    confirm({
      title: subtaskWords.askTitle,
      body: fmt(open === 1 ? subtaskWords.askBodyOne : subtaskWords.askBody, {
        count: open,
        title: task.title,
      }),
      confirmLabel: subtaskWords.completeAll,
      run: () => run(true),
      alternative: { label: subtaskWords.onlyThis, run: () => run(false) },
    })
  }

  async function detailedAdd(values: TaskEditorValues) {
    setShowDetails(false)
    await addTask({ listId, groupSlug, ...values })
  }

  async function saveEdit(taskId: Id<'tasks'>, values: TaskEditorValues) {
    setEditingId(null)
    await updateTask({
      taskId,
      groupSlug,
      title: values.title,
      dueDate: values.dueDate ?? null,
      priority: values.priority ?? null,
      labels: values.labels ?? null,
    })
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{name}</h3>
        <div className="flex items-center gap-2">
          <Pill>{local.pill}</Pill>
          <button
            type="button"
            aria-label={fmt(local.deleteList, { name })}
            className={iconButtonClass}
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <QuickAddForm
        placeholder={local.quickAdd}
        fieldLabel={fmt(local.newTaskIn, { name })}
        buttonLabel={local.addTask}
        onAdd={(title) => addTask({ listId, groupSlug, title })}
      />
      <button
        type="button"
        className="mb-2 text-xs text-[var(--muted)]"
        onClick={() => setShowDetails((s) => !s)}
      >
        {showDetails ? local.hideDetails : local.showDetails}
      </button>
      {showDetails && (
        <TaskEditor
          submitLabel={local.addTask}
          onSubmit={(values) => void detailedAdd(values)}
          onCancel={() => setShowDetails(false)}
        />
      )}

      {tasks?.map((t, i) =>
        editingId === t._id ? (
          <TaskEditor
            key={t._id}
            initial={{
              title: t.title,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
            }}
            submitLabel={messages.common.actions.save}
            onSubmit={(values) => void saveEdit(t._id, values)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <TaskRow
            key={t._id}
            task={{
              externalId: t._id,
              title: t.title,
              done: t.done,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
            }}
            onToggle={() => toggle(t)}
            actions={
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={fmt(local.moveUp, { task: t.title })}
                  className={iconButtonClass}
                  disabled={i === 0 || tasks[i - 1].done !== t.done}
                  onClick={() =>
                    void move({ taskId: t._id, groupSlug, direction: 'up' })
                  }
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={fmt(local.moveDown, { task: t.title })}
                  className={iconButtonClass}
                  disabled={
                    i === tasks.length - 1 || tasks[i + 1].done !== t.done
                  }
                  onClick={() =>
                    void move({ taskId: t._id, groupSlug, direction: 'down' })
                  }
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={fmt(local.edit, { task: t.title })}
                  className={iconButtonClass}
                  onClick={() => setEditingId(t._id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={fmt(local.delete, { task: t.title })}
                  className={iconButtonClass}
                  onClick={() => void removeTask({ taskId: t._id, groupSlug })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            }
          />
        ),
      )}
      {tasks?.length === 0 && (
        <p className="m-0 text-sm text-[var(--muted)]">{local.empty}</p>
      )}
      {dialog}
    </SurfaceCard>
  )
}
