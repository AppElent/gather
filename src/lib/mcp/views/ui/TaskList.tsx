import { type FormEvent, useState } from 'react'
import type { ListTask, TaskListResult } from '../types'
import type { ViewText } from './i18n'
import type { ViewProps } from './ViewRoot'

/** A fresh key per intended write; a retry of that write reuses it. */
function newKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function due(task: ListTask, today: string, text: ViewText) {
  if (!task.dueDate) return null
  const date = text.day(task.dueDate, 'dayMonth')
  const late = !task.done && task.dueDate < today
  return (
    <span className={late ? 'due late' : 'due'}>
      {text.fmt(late ? text.t.tasks.overdue : text.t.tasks.due, { date })}
    </span>
  )
}

export function TaskList({
  app,
  result,
  text,
  reload,
  header,
}: ViewProps<TaskListResult>) {
  const { t } = text
  const [showDone, setShowDone] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftKey, setDraftKey] = useState(newKey)
  const [adding, setAdding] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const refresh = () =>
    reload('show_task_list', {
      groupId: result.groupId,
      listId: result.listId,
    })

  const toggle = async (task: ListTask) => {
    setFailed(false)
    setPending((now) => new Set(now).add(task.id))
    try {
      const response = await app.callServerTool({
        name: 'update_task',
        arguments: {
          groupId: result.groupId,
          taskId: task.id,
          done: !task.done,
        },
      })
      if (response.isError) throw new Error('update_task failed')
      await refresh()
    } catch {
      setFailed(true)
    } finally {
      setPending((now) => {
        const next = new Set(now)
        next.delete(task.id)
        return next
      })
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return
    setFailed(false)
    setAdding(true)
    try {
      const response = await app.callServerTool({
        name: 'create_task',
        arguments: {
          groupId: result.groupId,
          listId: result.listId,
          idempotencyKey: draftKey,
          title,
        },
      })
      if (response.isError) throw new Error('create_task failed')
      setDraft('')
      setDraftKey(newKey())
      await refresh()
      void app.updateModelContext({
        content: [
          {
            type: 'text',
            text: `The user added the task "${title}" to "${result.listName}" from the task list view.`,
          },
        ],
      })
    } catch {
      // The same key stays, so trying again cannot add it twice.
      setFailed(true)
    } finally {
      setAdding(false)
    }
  }

  const open = result.tasks.filter((task) => !task.done)
  const done = result.tasks.filter((task) => task.done)
  const shown = showDone ? [...open, ...done] : open
  return (
    <section>
      <header className="toolbar">
        <div>
          <p className="eyebrow">{result.groupName}</p>
          <h2>{result.listName}</h2>
          <p className="muted small">{text.plural(open.length, t.tasks.open)}</p>
        </div>
        <div className="actions">{header}</div>
      </header>
      {failed && (
        <p className="notice danger" role="alert">
          {t.tasks.saveFailed}
        </p>
      )}
      {!result.canWrite && (
        <p className="notice">
          {result.readOnlyReason === 'external'
            ? t.tasks.external
            : t.common.readOnly}
        </p>
      )}
      {result.tasks.length === 0 ? (
        <p className="muted empty">{t.tasks.empty}</p>
      ) : open.length === 0 && !showDone ? (
        <p className="muted empty">{t.tasks.allDone}</p>
      ) : null}
      <ul className="tasks">
        {shown.map((task) => {
          const busy = pending.has(task.id)
          const label = text.fmt(task.done ? t.tasks.markOpen : t.tasks.markDone, {
            title: task.title,
          })
          return (
            <li key={task.id} className="task" data-done={task.done || undefined}>
              <input
                type="checkbox"
                checked={task.done}
                disabled={!result.canWrite || busy}
                aria-label={label}
                onChange={() => void toggle(task)}
              />
              <span className="task-body">
                <span className="task-title">{task.title}</span>
                <span className="task-meta">
                  {due(task, today, text)}
                  {task.priority && task.priority < 4 && (
                    <span className={`priority p${task.priority}`}>
                      {t.tasks.priority[task.priority]}
                    </span>
                  )}
                  {task.labels?.map((label) => (
                    <span key={label} className="label-chip">
                      {label}
                    </span>
                  ))}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {done.length > 0 && (
        <button
          type="button"
          className="link-button"
          onClick={() => setShowDone((now) => !now)}
        >
          {showDone
            ? t.tasks.hideDone
            : text.fmt(t.tasks.showDone, { count: done.length })}
        </button>
      )}
      {result.canWrite && (
        <form className="add-task" onSubmit={(event) => void add(event)}>
          <input
            type="text"
            value={draft}
            maxLength={500}
            placeholder={t.tasks.addPlaceholder}
            aria-label={t.tasks.addPlaceholder}
            disabled={adding}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="primary"
            disabled={adding || !draft.trim()}
          >
            {t.tasks.add}
          </button>
        </form>
      )}
    </section>
  )
}
