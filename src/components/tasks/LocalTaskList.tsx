import { useMutation, useQuery } from 'convex/react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { TaskEditor, type TaskEditorValues } from './TaskEditor'
import { TaskRow } from './TaskRow'

const iconButtonClass =
  'inline-flex items-center text-[var(--app-muted)] disabled:opacity-30'

export interface LocalTaskListProps {
  listId: Id<'taskLists'>
  name: string
  onRemoveList: () => void
}

export function LocalTaskList({
  listId,
  name,
  onRemoveList,
}: LocalTaskListProps) {
  const tasks = useQuery(api.tasks.listByList, { listId })
  const addTask = useMutation(api.tasks.add)
  const updateTask = useMutation(api.tasks.update)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const move = useMutation(api.tasks.move)
  const [quickTitle, setQuickTitle] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [editingId, setEditingId] = useState<Id<'tasks'> | null>(null)

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = quickTitle.trim()
    if (!trimmed) return
    setQuickTitle('')
    await addTask({ listId, title: trimmed })
  }

  async function detailedAdd(values: TaskEditorValues) {
    setShowDetails(false)
    await addTask({ listId, ...values })
  }

  async function saveEdit(taskId: Id<'tasks'>, values: TaskEditorValues) {
    setEditingId(null)
    await updateTask({
      taskId,
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
          <Pill>Local</Pill>
          <button
            type="button"
            aria-label={`Delete list ${name}`}
            className={iconButtonClass}
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <form onSubmit={quickAdd} className="mb-1 flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label={`New task in ${name}`}
          className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          aria-label="Add task"
          className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <button
        type="button"
        className="mb-2 text-xs text-[var(--app-muted)]"
        onClick={() => setShowDetails((s) => !s)}
      >
        {showDetails ? 'Hide details' : 'Add with details…'}
      </button>
      {showDetails && (
        <TaskEditor
          submitLabel="Add task"
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
            submitLabel="Save"
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
            onToggle={() => void toggleDone({ taskId: t._id })}
            actions={
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${t.title} up`}
                  className={iconButtonClass}
                  disabled={i === 0}
                  onClick={() => void move({ taskId: t._id, direction: 'up' })}
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${t.title} down`}
                  className={iconButtonClass}
                  disabled={i === tasks.length - 1}
                  onClick={() =>
                    void move({ taskId: t._id, direction: 'down' })
                  }
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${t.title}`}
                  className={iconButtonClass}
                  onClick={() => setEditingId(t._id)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${t.title}`}
                  className={iconButtonClass}
                  onClick={() => void removeTask({ taskId: t._id })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            }
          />
        ),
      )}
      {tasks?.length === 0 && (
        <p className="m-0 text-sm text-[var(--app-muted)]">No tasks yet.</p>
      )}
    </SurfaceCard>
  )
}
