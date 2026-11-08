import { Plus } from 'lucide-react'
import { useState } from 'react'

interface QuickAddFormProps {
  placeholder: string
  /** Names the field: which list the task goes into. */
  fieldLabel: string
  buttonLabel: string
  onAdd: (title: string) => Promise<unknown>
}

/**
 * A task by its title alone, one line and Enter. The field empties as the
 * task is sent, so the next one can be typed straight away.
 */
export function QuickAddForm({
  placeholder,
  fieldLabel,
  buttonLabel,
  onAdd,
}: QuickAddFormProps) {
  const [title, setTitle] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    await onAdd(trimmed)
  }

  return (
    <form onSubmit={submit} className="mb-1 flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label={fieldLabel}
        className="min-h-9 flex-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-transparent px-3 text-sm"
      />
      <button
        type="submit"
        aria-label={buttonLabel}
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  )
}
