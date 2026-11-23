import type { ExternalProviderId } from '@gather/core/domain'
import { applyLinkedWrite, possibleParents } from '@gather/core/linked-tasks'
import { Link } from '@tanstack/react-router'
import { useAction, useConvex } from 'convex/react'
import type { FunctionArgs } from 'convex/server'
import { CornerDownRight, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { UnifiedTask } from '../../../convex/lib/taskProviders/types'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { PROVIDER_LABELS } from '../../lib/oauth'
import { useConfirmAction } from '../app/ConfirmAction'
import { Pill, SurfaceCard } from '../app/ShellPrimitives'
import { QuickAddForm } from './QuickAddForm'
import { TaskEditor, type TaskEditorValues } from './TaskEditor'
import { TaskRow } from './TaskRow'

/**
 * How long a write may take. Convex holds an action that lost its connection
 * until it is back, so without a limit nothing would say it did not land.
 */
const WRITE_WAIT_MS = 30_000

function within<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('No answer in time')),
      WRITE_WAIT_MS,
    )
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

type LinkedTaskWrite = FunctionArgs<typeof api.taskLists.writeTask>['write']

const iconButtonClass =
  'inline-flex items-center text-[var(--muted)] disabled:opacity-30'

/**
 * Where the rows stand. `ok` is the provider's last answer, the only state
 * that may be written to; the others keep the last rows on screen.
 */
type LoadState = 'loading' | 'ok' | 'reconnect' | 'error'

export interface ExternalTaskListProps {
  listId: Id<'taskLists'>
  /** The Group the list — and the connection behind it — lives in. */
  groupSlug: string
  name: string
  provider: ExternalProviderId
  /** Whether Gather can write to this provider (`capabilities.write`). */
  writes: boolean
  onRemoveList: () => void
}

/**
 * A list kept in Notion or Todoist. A write goes to the provider first and
 * changes these rows only once it was accepted (ADR-0020, APP-448).
 */
export function ExternalTaskList({
  listId,
  groupSlug,
  name,
  provider,
  writes,
  onRemoveList,
}: ExternalTaskListProps) {
  const getTasks = useAction(api.taskLists.getTasks)
  const writeTask = useAction(api.taskLists.writeTask)
  const convex = useConvex()
  const [state, setState] = useState<LoadState>('loading')
  const [rows, setRows] = useState<UnifiedTask[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const writing = useRef(false)
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const { external, linkedWrite, local, subtasks: subtaskWords } = messages.tasks
  const label = PROVIDER_LABELS[provider]

  const load = useCallback(async () => {
    setState('loading')
    try {
      const result = await within(getTasks({ listId, groupSlug }))
      if (result.status === 'ok') setRows(result.tasks)
      setState(result.status)
    } catch {
      setState('error')
    }
  }, [getTasks, listId, groupSlug])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = () => {
    setProblem(null)
    void load()
  }

  /** Whether the provider took it. One write at a time. */
  async function write(change: LinkedTaskWrite): Promise<boolean> {
    if (writing.current) return false
    const failed = (reason: keyof typeof linkedWrite.failed) =>
      setProblem(fmt(linkedWrite.failed[reason], { provider: label }))
    if (state !== 'ok') {
      failed('stale')
      return false
    }
    // Convex would keep an unsent action and send it once back online.
    if (!convex.connectionState().isWebSocketConnected) {
      failed('offline')
      setState('error')
      return false
    }
    writing.current = true
    setBusy(true)
    setProblem(null)
    try {
      const result = await within(
        writeTask({ listId, groupSlug, write: change }),
      )
      if (result.status === 'reconnect') {
        setState('reconnect')
        return false
      }
      if (result.status === 'error') {
        failed(result.reason)
        await load()
        return false
      }
      setRows((current) => applyLinkedWrite(current, change, result.tasks))
      if (result.refresh) await load()
      return true
    } catch {
      // Nobody knows whether it landed: show what the provider has.
      failed('failed')
      await load()
      return false
    } finally {
      writing.current = false
      setBusy(false)
    }
  }

  async function saveEdit(task: UnifiedTask, values: TaskEditorValues) {
    const labels = values.labels ?? []
    const change = {
      ...(values.title !== task.title ? { title: values.title } : {}),
      ...(values.dueDate !== task.dueDate
        ? { dueDate: values.dueDate ?? null }
        : {}),
      ...(values.priority !== task.priority
        ? { priority: values.priority ?? null }
        : {}),
      ...(labels.join('\n') !== (task.labels ?? []).join('\n')
        ? { labels }
        : {}),
    }
    const saved =
      Object.keys(change).length === 0 ||
      (await write({ kind: 'update', taskId: task.externalId, ...change }))
    if (saved) setEditingId(null)
  }

  function childrenOf(taskId: string) {
    return rows.filter((row) => row.parentExternalId === taskId)
  }

  function toggle(task: UnifiedTask) {
    const open = childrenOf(task.externalId).filter((row) => !row.done).length
    const run = (withSubtasks: boolean) =>
      write({
        kind: 'setDone',
        taskId: task.externalId,
        done: !task.done,
        ...(withSubtasks ? { withSubtasks: true } : {}),
      })
    if (task.done || open === 0) {
      void run(false)
      return
    }
    confirm({
      title: subtaskWords.askTitle,
      body: fmt(open === 1 ? subtaskWords.askBodyOne : subtaskWords.askBody, {
        count: open,
        title: task.title,
      }),
      confirmLabel: subtaskWords.completeAll,
      errorFallback: fmt(linkedWrite.failed.failed, { provider: label }),
      run: () => run(true),
    })
  }

  function remove(task: UnifiedTask) {
    const count = childrenOf(task.externalId).length
    const run = () => write({ kind: 'delete', taskId: task.externalId })
    if (count === 0) {
      void run()
      return
    }
    confirm({
      title: fmt(local.delete, { task: task.title }),
      body: fmt(count === 1 ? subtaskWords.deleteBodyOne : subtaskWords.deleteBody, {
        count,
      }),
      confirmLabel: messages.common.actions.delete,
      errorFallback: fmt(linkedWrite.failed.failed, { provider: label }),
      run,
    })
  }

  const canWrite = writes && state === 'ok'
  const known = new Set(rows.map((row) => row.externalId))

  function renderTask(task: UnifiedTask) {
    const children = childrenOf(task.externalId)
    const parents = possibleParents(rows, task.externalId)
    const parent = rows.find((row) => row.externalId === task.parentExternalId)
    // Where it is now is always a choice, so that "not under a task" is one.
    if (parent && !parents.includes(parent)) parents.push(parent)
    return (
      <div key={task.externalId}>
        {editingId === task.externalId ? (
          <>
            <TaskEditor
              initial={task}
              submitLabel={messages.common.actions.save}
              onSubmit={(values) => void saveEdit(task, values)}
              onCancel={() => setEditingId(null)}
            />
            {parents.length > 0 ? (
              <select
                value={task.parentExternalId ?? ''}
                aria-label={linkedWrite.moveUnder}
                disabled={!canWrite || busy}
                onChange={(event) =>
                  void write({
                    kind: 'move',
                    taskId: task.externalId,
                    parentId: event.target.value || null,
                  })
                }
                className="mb-2 min-h-9 w-full rounded-[var(--radius-control)] border border-[var(--hair)] bg-transparent px-2 text-sm"
              >
                <option value="">{linkedWrite.topLevel}</option>
                {parents.map((parent) => (
                  <option key={parent.externalId} value={parent.externalId}>
                    {parent.title}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : (
          <TaskRow
            task={task}
            onToggle={canWrite && !busy ? () => toggle(task) : undefined}
            actions={
              writes ? (
                <span className="flex items-center gap-1">
                  {!task.done && !task.parentExternalId ? (
                    <button
                      type="button"
                      aria-label={fmt(linkedWrite.addSubtask, {
                        task: task.title,
                      })}
                      className={iconButtonClass}
                      disabled={!canWrite}
                      onClick={() =>
                        setAddingTo((open) =>
                          open === task.externalId ? null : task.externalId,
                        )
                      }
                    >
                      <CornerDownRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                  {!task.done ? (
                    <button
                      type="button"
                      aria-label={fmt(local.edit, { task: task.title })}
                      className={iconButtonClass}
                      disabled={!canWrite}
                      onClick={() => setEditingId(task.externalId)}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={fmt(local.delete, { task: task.title })}
                    className={iconButtonClass}
                    disabled={!canWrite || busy}
                    onClick={() => remove(task)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ) : undefined
            }
          />
        )}
        {children.length > 0 || addingTo === task.externalId ? (
          <div className="pl-6">
            {children.map(renderTask)}
            {addingTo === task.externalId ? (
              <QuickAddForm
                placeholder={subtaskWords.add}
                fieldLabel={fmt(linkedWrite.addSubtask, { task: task.title })}
                buttonLabel={subtaskWords.add}
                onAdd={(title) =>
                  write({ kind: 'create', title, parentId: task.externalId })
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <SurfaceCard>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-semibold">{name}</h3>
        <div className="flex items-center gap-2">
          <Pill>{PROVIDER_LABELS[provider]}</Pill>
          <button
            type="button"
            aria-label={fmt(external.refresh, { name })}
            className="inline-flex items-center text-[var(--muted)]"
            onClick={refresh}
            disabled={state === 'loading' || busy}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={fmt(messages.tasks.local.deleteList, { name })}
            className="inline-flex items-center text-[var(--muted)]"
            onClick={onRemoveList}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {state === 'loading' && rows.length === 0 && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded bg-[var(--surface-2)]"
            />
          ))}
        </div>
      )}
      {state === 'reconnect' && (
        <p className="m-0 text-sm text-[var(--muted)]">
          {fmt(external.reconnect, {
            provider: label,
          })}{' '}
          {/* The connection belongs to this Group, so the page that can fix it
              is this Group's settings and not the reader's own. */}
          <Link {...linkTo('groupSettings')} className="font-semibold">
            {external.goToSettings}
          </Link>
        </p>
      )}
      {state === 'error' && (
        <p className="m-0 text-sm text-[var(--muted)]">
          {external.loadFailed}{' '}
          <button
            type="button"
            className="font-semibold"
            onClick={refresh}
          >
            {messages.common.actions.retry}
          </button>
        </p>
      )}
      {problem ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger)]">
          {problem}
        </p>
      ) : null}
      {/* Also while a failed write loads the list again: it holds the title. */}
      {writes ? (
        <QuickAddForm
          placeholder={local.quickAdd}
          fieldLabel={fmt(local.newTaskIn, { name })}
          buttonLabel={local.addTask}
          onAdd={(title) => write({ kind: 'create', title })}
        />
      ) : null}
      {state === 'ok' && rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {fmt(external.empty, { provider: label })}
        </p>
      ) : null}
      {rows
        .filter(
          (row) => !row.parentExternalId || !known.has(row.parentExternalId),
        )
        .map(renderTask)}
      {dialog}
    </SurfaceCard>
  )
}
