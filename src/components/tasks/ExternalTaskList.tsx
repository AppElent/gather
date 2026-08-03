import { Link } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { UnifiedTask } from '../../../convex/lib/taskProviders/types'
import { groupLink } from '../../lib/groupPaths'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { TaskRow } from './TaskRow'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; tasks: UnifiedTask[] }
  | { status: 'reconnect'; provider: 'notion' | 'todoist' }
  | { status: 'error'; message: string }

const PROVIDER_LABELS = { notion: 'Notion', todoist: 'Todoist' } as const

export interface ExternalTaskListProps {
  listId: Id<'taskLists'>
  /** The Group the list — and the connection behind it — lives in. */
  groupSlug: string
  name: string
  provider: 'notion' | 'todoist'
  onRemoveList: () => void
}

export function ExternalTaskList({
  listId,
  groupSlug,
  name,
  provider,
  onRemoveList,
}: ExternalTaskListProps) {
  const getTasks = useAction(api.taskLists.getTasks)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      setState(await getTasks({ listId, groupSlug }))
    } catch {
      setState({ status: 'error', message: 'Could not load this list.' })
    }
  }, [getTasks, listId, groupSlug])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{name}</h3>
        <div className="flex items-center gap-2">
          <Pill>{PROVIDER_LABELS[provider]}</Pill>
          <button
            type="button"
            aria-label={`Refresh ${name}`}
            className="inline-flex items-center text-[var(--app-muted)]"
            onClick={() => void load()}
            disabled={state.status === 'loading'}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Delete list ${name}`}
            className="inline-flex items-center text-[var(--app-muted)]"
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      )}
      {state.status === 'reconnect' && (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          The {PROVIDER_LABELS[state.provider]} connection needs to be
          reconnected.{' '}
          {/* The connection belongs to this Group, so the page that can fix it
              is this Group's settings and not the reader's own. */}
          <Link {...groupLink('settings', groupSlug)} className="font-semibold">
            Go to group settings
          </Link>
        </p>
      )}
      {state.status === 'error' && (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {state.message}{' '}
          <button
            type="button"
            className="font-semibold"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      )}
      {state.status === 'ok' &&
        (state.tasks.length === 0 ? (
          <p className="m-0 text-sm text-[var(--app-muted)]">
            No open tasks in this {PROVIDER_LABELS[provider]} list.
          </p>
        ) : (
          state.tasks.map((t) => <TaskRow key={t.externalId} task={t} />)
        ))}
    </SurfaceCard>
  )
}
