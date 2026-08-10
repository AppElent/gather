import { Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { TaskListBackendView } from '../../../convex/taskLists'
import { groupLink } from '../../lib/groupPaths'
import { fmt, useMessages } from '../../lib/i18n'
import { type ExternalProvider, PROVIDER_LABELS } from '../../lib/oauth'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { TaskEditor, type TaskEditorValues } from './TaskEditor'
import { TaskRow } from './TaskRow'
import { useTaskCommands } from './useTaskCommands'

const iconButtonClass =
  'inline-flex items-center text-[var(--app-muted)] disabled:opacity-30'

export interface TaskListCardProps {
  listId: Id<'taskLists'>
  /** The Group the list — and the connection behind it — lives in. */
  groupSlug: string
  name: string
  onRemoveList: () => void
}

/**
 * One task list, whatever it is backed by.
 *
 * There is one card because there is one Task experience: a list backed by
 * Todoist is read in the same place, in the same shape, with the same controls
 * as a local one. What differs is what the Backend can do, and the card asks it
 * — `backend.capabilities` — instead of asking which provider it is
 * (ADR-0014). A control the Backend cannot support is not rendered as a button
 * that fails; it is absent, and the card says why.
 *
 * An external list is read from a cache and fetched on first open and on
 * Refresh, never on a schedule (ADR-0013). When the provider cannot be reached
 * the cached tasks stay on screen, explicitly stale and read-only — the last
 * thing the provider said is more useful than an empty card, as long as nobody
 * can mistake it for something they may change.
 */
export function TaskListCard({
  listId,
  groupSlug,
  name,
  onRemoveList,
}: TaskListCardProps) {
  const backend = useQuery(api.taskLists.backend, { listId, groupSlug })
  const tasks = useQuery(api.tasks.listByList, { listId, groupSlug })
  const refresh = useAction(api.taskLists.refresh)
  const commands = useTaskCommands(listId, groupSlug)

  const [quickTitle, setQuickTitle] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [editingId, setEditingId] = useState<Id<'tasks'> | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const messages = useMessages()
  const { local, external } = messages.tasks

  const runRefresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshError(false)
    try {
      const result = await refresh({ listId, groupSlug })
      // A failure the action reported is already on the list as a stale
      // marker, which the banner below reads. This flag is only for the
      // request that never arrived.
      if (result.status === 'error') setRefreshError(true)
    } catch {
      setRefreshError(true)
    } finally {
      setRefreshing(false)
    }
  }, [refresh, listId, groupSlug])

  // Fetched when the list is first opened, and not again until somebody asks.
  // The ref is what keeps that "first" honest across re-renders — including a
  // refresh that failed, which must not turn into a retry loop.
  const firstOpen = useRef(false)
  const neverSynced = backend?.sync?.neverSynced === true
  useEffect(() => {
    if (!neverSynced || firstOpen.current) return
    firstOpen.current = true
    void runRefresh()
  }, [neverSynced, runRefresh])

  if (backend === undefined || tasks === undefined) {
    return (
      <SurfaceCard>
        <div className="h-32 animate-pulse rounded bg-[var(--app-surface-muted)]" />
      </SurfaceCard>
    )
  }

  const { capabilities, readOnly } = backend
  const providerLabel =
    backend.provider === 'local'
      ? null
      : PROVIDER_LABELS[backend.provider as ExternalProvider]

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-base font-semibold">{name}</h3>
          {/* Which account and which source, because a Group may hold two
              Todoists and "Todoist" alone would not say whose tasks these
              are. */}
          {backend.source?.sourceName && (
            <p className="m-0 truncate text-xs text-[var(--app-muted)]">
              {backend.source.accountLabel
                ? fmt(external.source, {
                    source: backend.source.sourceName,
                    account: backend.source.accountLabel,
                  })
                : fmt(external.sourceUnknownAccount, {
                    source: backend.source.sourceName,
                  })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Pill>{providerLabel ?? local.pill}</Pill>
          {providerLabel && (
            <button
              type="button"
              aria-label={fmt(external.refresh, { name })}
              className={iconButtonClass}
              onClick={() => void runRefresh()}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
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

      <BackendNotice
        backend={backend}
        providerLabel={providerLabel}
        groupSlug={groupSlug}
        refreshFailed={refreshError}
        text={external}
        settingsLabel={external.goToSettings}
      />

      {capabilities.create && !readOnly && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = quickTitle.trim()
              if (!trimmed) return
              setQuickTitle('')
              void commands.add({ title: trimmed })
            }}
            className="mb-1 flex gap-2"
          >
            <input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={local.quickAdd}
              aria-label={fmt(local.newTaskIn, { name })}
              className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
            />
            <button
              type="submit"
              aria-label={local.addTask}
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
            {showDetails ? local.hideDetails : local.showDetails}
          </button>
          {showDetails && (
            <TaskEditor
              capabilities={capabilities}
              submitLabel={local.addTask}
              onSubmit={(values: TaskEditorValues) => {
                setShowDetails(false)
                void commands.add(values)
              }}
              onCancel={() => setShowDetails(false)}
            />
          )}
        </>
      )}

      {tasks.map((t, i) =>
        editingId === t._id ? (
          <TaskEditor
            key={t._id}
            capabilities={capabilities}
            initial={{
              title: t.title,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
            }}
            submitLabel={messages.common.actions.save}
            onSubmit={(values: TaskEditorValues) => {
              setEditingId(null)
              void commands.update(t._id, values)
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <TaskRow
            key={t._id}
            task={{
              externalId: t.externalId ?? t._id,
              title: t.title,
              done: t.done,
              dueDate: t.dueDate,
              priority: t.priority,
              labels: t.labels,
              url: t.url,
            }}
            onToggle={
              capabilities.complete && !readOnly
                ? () => void commands.toggleDone(t._id)
                : undefined
            }
            actions={
              <span className="flex items-center gap-1">
                {capabilities.reorder && !readOnly && (
                  <>
                    <button
                      type="button"
                      aria-label={fmt(local.moveUp, { task: t.title })}
                      className={iconButtonClass}
                      disabled={i === 0 || tasks[i - 1].done !== t.done}
                      onClick={() => void commands.move(t._id, 'up')}
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
                      onClick={() => void commands.move(t._id, 'down')}
                    >
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}
                {capabilities.edit && !readOnly && (
                  <button
                    type="button"
                    aria-label={fmt(local.edit, { task: t.title })}
                    className={iconButtonClass}
                    onClick={() => setEditingId(t._id)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                {capabilities.delete && !readOnly && (
                  <button
                    type="button"
                    aria-label={fmt(local.delete, { task: t.title })}
                    className={iconButtonClass}
                    onClick={() => void commands.remove(t._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </span>
            }
          />
        ),
      )}

      {tasks.length === 0 && (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          {providerLabel
            ? backend.sync?.neverSynced
              ? fmt(external.neverSynced, { provider: providerLabel })
              : fmt(external.empty, { provider: providerLabel })
            : local.empty}
        </p>
      )}
    </SurfaceCard>
  )
}

/**
 * The one sentence a reader needs about why this list is not fully live —
 * rendered above the tasks rather than in place of them, because the cached
 * tasks are still worth reading (ADR-0013).
 */
function BackendNotice({
  backend,
  providerLabel,
  groupSlug,
  refreshFailed,
  text,
  settingsLabel,
}: {
  backend: TaskListBackendView
  providerLabel: string | null
  groupSlug: string
  refreshFailed: boolean
  text: {
    stale: string
    reconnectStale: string
    unconfigured: string
    readOnlyProvider: string
    loadFailed: string
  }
  settingsLabel: string
}) {
  const state = backend.sync?.state
  if (!providerLabel || !state) return null

  if (state === 'unconfigured') {
    return <Notice>{text.unconfigured}</Notice>
  }
  if (state === 'reconnect') {
    return (
      <Notice>
        {fmt(text.reconnectStale, { provider: providerLabel })}{' '}
        {/* The connection belongs to this Group, so the page that can fix it
            is this Group's settings and not the reader's own. */}
        <Link {...groupLink('settings', groupSlug)} className="font-semibold">
          {settingsLabel}
        </Link>
      </Notice>
    )
  }
  if (state === 'stale') {
    return <Notice>{fmt(text.stale, { provider: providerLabel })}</Notice>
  }
  if (refreshFailed) {
    return <Notice>{text.loadFailed}</Notice>
  }
  // Live, and read-only because the provider is read-only rather than because
  // anything is wrong — worth saying once, quietly.
  if (!backend.capabilities.create && !backend.capabilities.edit) {
    return (
      <Notice>{fmt(text.readOnlyProvider, { provider: providerLabel })}</Notice>
    )
  }
  return null
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-2 rounded-[var(--app-radius)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-xs text-[var(--app-muted)]">
      {children}
    </p>
  )
}
