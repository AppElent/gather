import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SurfaceCard } from '../app/ShellPrimitives'
import { AddListFlow } from './AddListFlow'
import { ExternalTaskList } from './ExternalTaskList'
import { LocalTaskList } from './LocalTaskList'
import type { TaskNav } from './taskNav'

export interface TasksPageProps {
  /** The Group whose lists these are. Always the one in the URL. */
  groupSlug: string
  nav: TaskNav
}

/**
 * A household's task lists, whole.
 *
 * Task lists are Group-scoped content, so the slug goes to Convex with every
 * read and every write: this is the lists of the Group in the address, and
 * adding one — local or linked — puts it there. There is no slugless form to
 * fall back to, and so no "pick a group first" state: `/g/<slug>/tasks` is the
 * only page that renders this.
 */
export function TasksPage({ groupSlug, nav }: TasksPageProps) {
  const lists = useQuery(api.taskLists.list, { groupSlug })
  const removeList = useMutation(api.taskLists.remove)
  const [adding, setAdding] = useState(false)

  function confirmRemove(listId: Id<'taskLists'>, name: string) {
    if (window.confirm(`Delete the list "${name}"?`)) {
      void removeList({ listId, groupSlug })
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">Tasks</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Shared lists — local ones live here, linked ones mirror Notion or
            Todoist.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add list
        </button>
      </div>

      {adding && (
        <AddListFlow
          groupSlug={groupSlug}
          returnTo={nav.returnTo}
          onDone={() => setAdding(false)}
        />
      )}

      {lists === undefined ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : lists.length === 0 && !adding ? (
        <SurfaceCard>
          <div className="grid gap-3 text-center">
            <h3 className="m-0 text-base font-semibold">No lists yet</h3>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Create a local list, or link one from Notion or Todoist.
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
            >
              Add your first list
            </button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-2">
          {lists.map((l) =>
            l.provider === 'local' ? (
              <LocalTaskList
                key={l._id}
                listId={l._id}
                groupSlug={groupSlug}
                name={l.name}
                onRemoveList={() => confirmRemove(l._id, l.name)}
              />
            ) : (
              <ExternalTaskList
                key={l._id}
                listId={l._id}
                groupSlug={groupSlug}
                name={l.name}
                provider={l.provider}
                onRemoveList={() => confirmRemove(l._id, l.name)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
