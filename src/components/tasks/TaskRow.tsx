import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { UnifiedTask } from '../../../convex/lib/taskProviders/types'

const PRIORITY_STYLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-red-500/15 text-red-600',
  2: 'bg-orange-500/15 text-orange-600',
  3: 'bg-blue-500/15 text-blue-600',
  4: 'bg-[var(--app-surface-muted)] text-[var(--app-muted)]',
}

export interface TaskRowProps {
  task: UnifiedTask
  onToggle?: () => void
  /** Extra per-row controls (edit/delete/move) rendered at the end. */
  actions?: ReactNode
}

export function TaskRow({ task, onToggle, actions }: TaskRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <input
        type="checkbox"
        checked={task.done}
        disabled={!onToggle}
        onChange={onToggle}
        aria-label={`Toggle ${task.title}`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          task.done ? 'text-[var(--app-muted)] line-through' : ''
        }`}
      >
        {task.title}
      </span>
      {task.priority && (
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}
        >
          P{task.priority}
        </span>
      )}
      {task.labels?.map((label) => (
        <span
          key={label}
          className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--app-muted)]"
        >
          {label}
        </span>
      ))}
      {task.dueDate && (
        <span className="text-xs text-[var(--app-muted)]">{task.dueDate}</span>
      )}
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${task.title} in its source app`}
          className="text-[var(--app-muted)]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {actions}
    </div>
  )
}
