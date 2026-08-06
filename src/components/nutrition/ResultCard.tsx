import type { ReactNode } from 'react'

interface Props {
  /** The picture, or the space one would take. Absent for a row that has none to show. */
  thumbnail?: ReactNode
  title: string
  /** The brand, the Group a recipe is in — whatever tells two similar rows apart. */
  subtitle?: ReactNode
  /** The figure that makes the row worth choosing, shown without expanding it. */
  meta?: ReactNode
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * One row of the add sheet, whatever kind of thing it holds.
 *
 * The single rule the sheet is built on: every row is a card, every card
 * expands in place, and nothing is written to the diary until an explicit
 * confirm inside it. Foods, Recipes and Open Food Facts results are identical
 * in this respect, which is why the shell is one component and only its insides
 * differ.
 */
export function ResultCard({
  thumbnail,
  title,
  subtitle,
  meta,
  expanded,
  onToggle,
  children,
}: Props) {
  return (
    <li className="rounded-[var(--app-radius)] border border-[var(--app-border)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        {thumbnail}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="block truncate text-xs opacity-60">
              {subtitle}
            </span>
          )}
        </span>
        {meta && <span className="shrink-0 text-xs opacity-60">{meta}</span>}
      </button>
      {expanded && (
        <div className="border-t border-[var(--app-border)] px-3 py-3">
          {children}
        </div>
      )}
    </li>
  )
}
