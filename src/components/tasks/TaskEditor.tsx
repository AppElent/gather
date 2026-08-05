import { useState } from 'react'
import { useMessages } from '../../lib/i18n'

export interface TaskEditorValues {
  title: string
  dueDate?: string
  priority?: 1 | 2 | 3 | 4
  labels?: string[]
}

export interface TaskEditorProps {
  initial?: TaskEditorValues
  submitLabel: string
  onSubmit: (values: TaskEditorValues) => void
  onCancel: () => void
}

const inputClass =
  'min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-2 text-sm'

export function TaskEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [priority, setPriority] = useState<string>(
    initial?.priority ? String(initial.priority) : '',
  )
  const [labels, setLabels] = useState(initial?.labels?.join(', ') ?? '')
  const messages = useMessages()
  const { editor } = messages.tasks

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const parsedLabels = labels
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
    onSubmit({
      title: trimmed,
      dueDate: dueDate || undefined,
      priority: priority ? (Number(priority) as 1 | 2 | 3 | 4) : undefined,
      labels: parsedLabels.length ? parsedLabels : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-2 py-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={editor.title}
        aria-label={editor.title}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label={editor.dueDate}
          className={inputClass}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label={editor.priority}
          className={inputClass}
        >
          <option value="">{editor.noPriority}</option>
          <option value="1">{editor.p1}</option>
          <option value="2">{editor.p2}</option>
          <option value="3">{editor.p3}</option>
          <option value="4">{editor.p4}</option>
        </select>
        <input
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          placeholder={editor.labelsPlaceholder}
          aria-label={editor.labels}
          className={`${inputClass} flex-1`}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-9 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 px-2 text-sm text-[var(--app-muted)]"
        >
          {messages.common.actions.cancel}
        </button>
      </div>
    </form>
  )
}
