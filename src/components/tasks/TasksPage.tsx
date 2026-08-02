import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConfirmAction } from '../app/ConfirmAction'
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
  const { confirm, dialog } = useConfirmAction()

  function confirmRemove(listId: Id<'taskLists'>, name: string) {
    confirm({
      title: `Delete the list “${name}”?`,
      body: 'Its tasks go with it, for everyone in this group.',
      confirmLabel: 'Delete list',
      errorFallback: 'Could not delete that list.',
      run: () => removeList({ listId, groupSlug }),
    })
  }

  return (
    // Full width. The shell's `main` already supplies the page's margins, so a
    // `max-w-5xl` on top of them centred the content inside its own column and
    // left dead space either side — and with a two-column grid inside that, one
    // list sat in the left half of an already-narrow measure and the page read
    // as mostly empty. Cards of task titles are not prose and want no reading
    // measure; they want the columns the width buys.
    <div className="grid gap-4">
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        // A third column once there is room for one, so the extra width goes
        // into more lists side by side rather than into two very wide cards.
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
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

      {dialog}
    </div>
  )
}
