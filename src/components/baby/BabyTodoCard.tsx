import { useMutation, useQuery } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SurfaceCard } from '../app/ShellPrimitives'
import { TaskRow } from '../tasks/TaskRow'

interface BabyTodoCardProps {
  taskListId: Id<'taskLists'>
}

/** Pinned quick-capture to-do card at the top of the baby page — backed by
 * a local taskList (see babies.ensureTodoList) so it's just the existing
 * Tasks module under a different lens, not a parallel todo concept. */
export function BabyTodoCard({ taskListId }: BabyTodoCardProps) {
  const tasks = useQuery(api.tasks.listByList, { listId: taskListId })
  const addTask = useMutation(api.tasks.add)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const [title, setTitle] = useState('')

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    await addTask({ listId: taskListId, title: trimmed })
  }

  const open = (tasks ?? []).filter((t) => !t.done)

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-2 text-sm font-semibold">To-do</h2>
      <form onSubmit={quickAdd} className="mb-1 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Buy diapers, call pediatrician…"
          aria-label="Add a to-do"
          className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          aria-label="Add to-do"
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      {tasks !== undefined && open.length === 0 ? (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          Nothing to do — nice.
        </p>
      ) : (
        open.map((t) => (
          <TaskRow
            key={t._id}
            task={{ externalId: t._id, title: t.title, done: t.done }}
            onToggle={() => void toggleDone({ taskId: t._id })}
            actions={
              <button
                type="button"
                aria-label={`Delete ${t.title}`}
                className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded-[var(--app-radius)] text-[var(--app-muted)]"
                onClick={() => void removeTask({ taskId: t._id })}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          />
        ))
      )}
    </SurfaceCard>
  )
}
