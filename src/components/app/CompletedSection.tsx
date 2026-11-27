import { Check, ChevronDown } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { useMessages } from '../../lib/i18n'

/**
 * The collapsed **Completed (n)** row under a list (the phone's
 * `CompletedSection`): a `surface` row with the card corner, a 24 px disc in
 * the accent with its check, the label, the count in `muted`, a chevron.
 * Collapsed by default; it opens in place and says so (`aria-expanded`).
 * Nothing at all when the count is 0.
 */
export function CompletedSection({
  count,
  children,
  initiallyExpanded = false,
}: {
  count: number
  /** The completed rows (an `InsetList`), drawn when expanded. */
  children: ReactNode
  initiallyExpanded?: boolean
}) {
  const label = useMessages().common.completed
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const panelId = useId()

  if (count <= 0) {
    // Emptied while open: the next completed row starts put away again.
    if (expanded) setExpanded(false)
    return null
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex min-h-[var(--size-row-min)] w-full items-center gap-3 rounded-[var(--radius-card)] border-0 bg-[var(--surface)] px-4 text-left font-[inherit] text-[var(--ink)] hover:bg-[var(--surface-2)]"
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--on-accent)]"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <span className="flex-1 text-body">
          {label}{' '}
          <span className="text-[var(--muted)] tabular-nums">({count})</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-[var(--muted)] transition-transform motion-reduce:transition-none ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded ? <div id={panelId}>{children}</div> : null}
    </div>
  )
}
