import { useMutation, useQuery } from 'convex/react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'
import { QuickAddForm } from '../tasks/QuickAddForm'
import { TaskRow } from '../tasks/TaskRow'

interface BabyChecklistCardProps {
  taskListId: Id<'taskLists'>
  /**
   * The Group the child — and so this list — lives in. The card sits on a
   * Group page and asks the Tasks module about the same Group that page does.
   */
  groupSlug: string
  title: string
  placeholder: string
  /** If true, the card starts collapsed to a single summary line. */
  collapsible?: boolean
}

/** Pinned quick-capture checklist card on the baby page (to-dos, questions
 * for the pediatrician, …) — backed by a local taskList (see
 * babies.ensureAuxLists) so each is just the existing
 * Tasks module under a different lens, not a parallel concept. */
export function BabyChecklistCard({
  taskListId,
  groupSlug,
  title,
  placeholder,
  collapsible = false,
}: BabyChecklistCardProps) {
  const { child } = useMessages().baby.log
  const [open, setOpen] = useState(!collapsible)
  const tasks = useQuery(api.tasks.listByList, {
    listId: taskListId,
    groupSlug,
  })
  const addTask = useMutation(api.tasks.add)
  const toggleDone = useMutation(api.tasks.toggleDone)
  const removeTask = useMutation(api.tasks.remove)

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
          <QuickAddForm
            placeholder={placeholder}
            fieldLabel={fmt(child.addTo, { list: title })}
            buttonLabel={fmt(child.addTo, { list: title })}
            onAdd={(task) =>
              addTask({ listId: taskListId, groupSlug, title: task })
            }
          />
          {tasks !== undefined && openItems.length === 0 ? (
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {child.checklistEmpty}
            </p>
          ) : (
            openItems.map((t) => (
              <TaskRow
                key={t._id}
                task={{ externalId: t._id, title: t.title, done: t.done }}
                onToggle={() => void toggleDone({ taskId: t._id, groupSlug })}
                actions={
                  <button
                    type="button"
                    aria-label={fmt(child.deleteTask, { task: t.title })}
                    className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded-[var(--app-radius)] text-[var(--app-muted)]"
                    onClick={() =>
                      void removeTask({ taskId: t._id, groupSlug })
                    }
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
