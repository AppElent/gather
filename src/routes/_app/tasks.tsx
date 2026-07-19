import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SurfaceCard } from '../../components/app/ShellPrimitives'
import { AddListFlow } from '../../components/tasks/AddListFlow'
import { ExternalTaskList } from '../../components/tasks/ExternalTaskList'
import { LocalTaskList } from '../../components/tasks/LocalTaskList'

export const Route = createFileRoute('/_app/tasks')({
  component: TasksPage,
})

function TasksPage() {
  const lists = useQuery(api.taskLists.list)
  const removeList = useMutation(api.taskLists.remove)
  const [adding, setAdding] = useState(false)

  function confirmRemove(listId: Id<'taskLists'>, name: string) {
    if (window.confirm(`Delete the list "${name}"?`)) {
      void removeList({ listId })
    }
  }

  if (lists === null) {
    return (
      <div className="mx-auto max-w-md">
        <SurfaceCard>
          <div className="grid gap-2 text-center">
            <h2 className="m-0 text-base font-semibold">
              Pick a default group first
            </h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Task lists belong to a group. Choose or create one, then come
              back.
            </p>
            <Link to="/groups" className="text-sm font-semibold">
              Go to groups
            </Link>
          </div>
        </SurfaceCard>
      </div>
    )
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

      {adding && <AddListFlow onDone={() => setAdding(false)} />}

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
                name={l.name}
                onRemoveList={() => confirmRemove(l._id, l.name)}
              />
            ) : (
              <ExternalTaskList
                key={l._id}
                listId={l._id}
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
