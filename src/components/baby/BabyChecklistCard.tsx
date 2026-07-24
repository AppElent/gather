import { useMutation, useQuery } from 'convex/react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SurfaceCard } from '../app/ShellPrimitives'
import { TaskRow } from '../tasks/TaskRow'

interface BabyChecklistCardProps {
  taskListId: Id<'taskLists'>
  title: string
  placeholder: string
  /** If true, the card starts collapsed to a single summary line. */
  collapsible?: boolean
}

/** Pinned quick-capture checklist card on the baby page (to-dos, questions
 * for the pediatrician, …) — backed by a local taskList (see
 * babies.ensureTodoList / ensureQuestionsList) so each is just the existing
 * Tasks module under a different lens, not a parallel concept. */
export function BabyChecklistCard({
  taskListId,
  title,
  placeholder,
  collapsible = false,
}: BabyChecklistCardProps) {
  const [open, setOpen] = useState(!collapsible)
  const tasks = useQuery(api.tasks.listByList, { listId: taskListId })
  const addTask = useMutation(api.tasks.add)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)
  const [text, setText] = useState('')

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    if (collapsible) setOpen(true)
    await addTask({ listId: taskListId, title: trimmed })
  }

  const openItems = (tasks ?? []).filter((t) => !t.done)

  return (
    <SurfaceCard>
      {collapsible ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <h2 className="m-0 text-sm font-semibold">
            {title}
            {openItems.length > 0 && (
              <span className="ml-1.5 text-[var(--app-muted)]">
                ({openItems.length})
              </span>
            )}
          </h2>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--app-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h2 className="m-0 mb-2 text-sm font-semibold">{title}</h2>
      )}

      {open && (
        <div className={collapsible ? 'mt-2' : undefined}>
          <form onSubmit={quickAdd} className="mb-1 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              aria-label={`Add to ${title}`}
              className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
            />
            <button
              type="submit"
              aria-label={`Add to ${title}`}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          {tasks !== undefined && openItems.length === 0 ? (
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Nothing here — nice.
            </p>
          ) : (
            openItems.map((t) => (
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
        </div>
      )}
    </SurfaceCard>
  )
}
