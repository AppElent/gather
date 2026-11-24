import { localIsoDate } from '@gather/core/civil-date'
import type { TaskList } from '@gather/core/task-model'
import type { QuickAdd as ParsedLine } from '@gather/core/task-quick-add'
import {
  LINKED_KINDS,
  parseOnly,
  quickAddChipLabel,
} from '@gather/core/task-quick-add-line'
import { Plus, X } from 'lucide-react'
import { type FormEvent, type RefObject, useId, useRef, useState } from 'react'
import { fmt, useI18n } from '../../lib/i18n'
import { useTaskPeople } from './data'
import { useWorkspace } from './TasksWorkspace'
import { useAddShortcut } from './useAddShortcut'

const clock = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * The add field (APP-307's grammar): what was recognised shows as chips under
 * the line, each with an × that turns it back into words. Enter saves.
 */
export function QuickAdd({
  lists,
  preset = {},
  toLastSection = false,
  fieldRef,
}: {
  /** The lists it can go on, the first one unless another is chosen. */
  lists: readonly TaskList[]
  /** What the page gives a task added on it: Today's date, or me. */
  preset?: { dueDate?: string; assigneeId?: string }
  /** A list's own page adds at its end, so in its last section. */
  toLastSection?: boolean
  fieldRef?: RefObject<HTMLInputElement | null>
}) {
  const { locale, messages: t } = useI18n()
  const words = t.tasks.web.add
  const { actions, show, fail } = useWorkspace()
  const { people } = useTaskPeople()
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = fieldRef ?? ownRef
  const hintId = useId()
  const [line, setLine] = useState('')
  const [dismissed, setDismissed] = useState<string[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  /** A line that failed keeps its key, so trying again is the same task. */
  const retry = useRef<{ line: string; key: string } | null>(null)
  useAddShortcut(ref)

  const list = lists.find((each) => each.id === chosen) ?? lists[0]
  if (!list) return null
  const linked = list.provider !== 'local'
  const today = localIsoDate()
  const parsed = parseOnly(
    line,
    { today, now: clock(), members: people, dismissed },
    linked ? LINKED_KINDS : undefined,
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!parsed.title) return
    const sent: ParsedLine = {
      ...parsed,
      dueDate: parsed.dueDate ?? preset.dueDate,
    }
    const key =
      retry.current?.line === line ? retry.current.key : crypto.randomUUID()
    const keptDismissed = dismissed
    setLine('')
    setDismissed([])
    try {
      const { reminderFailed } = await actions.addParsed(list.id, sent, key, {
        assigneeId: linked ? undefined : preset.assigneeId,
        sectionId: toLastSection ? list.sections.at(-1)?.id : undefined,
      })
      retry.current = null
      if (reminderFailed)
        show({ message: t.tasks.quickAdd.reminderFailed, failed: true })
    } catch (error) {
      // Back in the field, unless another line is being typed by now.
      retry.current = { line, key }
      setLine((now) => now || line)
      setDismissed((now) => (now.length > 0 ? now : keptDismissed))
      fail(error, t.tasks.quickAdd.failed)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <div className="flex min-h-12 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--surface)] px-4 focus-within:outline-2 focus-within:outline-[var(--ink)]">
        <Plus
          className="size-[18px] shrink-0 text-[var(--home-text)]"
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <input
          ref={ref}
          value={line}
          onChange={(event) => setLine(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.currentTarget.blur()
          }}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={words.label}
          aria-describedby={parsed.parts.length > 0 ? hintId : undefined}
          aria-keyshortcuts="N"
          placeholder={linked ? words.placeholderLinked : words.placeholder}
          className="min-h-12 min-w-0 flex-1 border-0 bg-transparent text-[16px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        {lists.length > 1 ? (
          <select
            aria-label={fmt(t.tasks.quickAdd.listChip, { list: list.name })}
            value={list.id}
            onChange={(event) => setChosen(event.target.value)}
            className="min-h-9 max-w-[38%] shrink-0 rounded-[var(--radius-pill)] border-0 bg-[var(--surface-2)] px-3 text-[16px] text-[var(--ink)] sm:text-subhead"
          >
            {lists.map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
          </select>
        ) : null}
        <kbd
          title={words.shortcut}
          aria-hidden="true"
          className="hidden rounded-md bg-[var(--surface-2)] px-[7px] py-0.5 font-[inherit] text-[12px] font-semibold text-[var(--muted)] lg:inline"
        >
          N
        </kbd>
      </div>
      {parsed.parts.length > 0 ? (
        <ul
          id={hintId}
          aria-label={words.recognised}
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
        >
          {parsed.parts.map((part) => {
            const label = quickAddChipLabel(part, parsed, today, locale, {
              today: t.tasks.task.today,
              tomorrow: t.tasks.task.tomorrow,
              repeat: t.tasks.repeat.summary,
            })
            return (
              <li
                key={part.key}
                className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--surface)] pl-3.5 text-subhead font-semibold text-[var(--ink)]"
              >
                {label}
                <button
                  type="button"
                  aria-label={fmt(t.tasks.quickAdd.remove, { part: label })}
                  onClick={() => {
                    setDismissed([...dismissed, part.key])
                    ref.current?.focus()
                  }}
                  className="grid size-9 pointer-coarse:size-[var(--size-control-min)] cursor-pointer place-items-center rounded-[var(--radius-pill)] border-0 bg-transparent text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </form>
  )
}
