import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppLink } from '../../lib/appLink'
import { fmt, useMessages } from '../../lib/i18n'

/**
 * One step of a page's local hierarchy.
 *
 * `label` is already in the reader's language — half of what a trail says is
 * content (a food's name, a recipe's title, a child's name) and is never
 * translated (ADR-0011), so resolving the words is the caller's job and this
 * component never reaches for a message tree on their behalf.
 *
 * `link` is absent for exactly one step: the page you are standing on. A step
 * with no link renders as text carrying `aria-current="page"`, which is what
 * tells a screen reader where the trail ends.
 */
export interface Crumb {
  label: string
  link?: AppLink
}

export interface BreadcrumbsProps {
  /** Ancestors first, the page you are on last. */
  trail: readonly Crumb[]
  /**
   * Replaces the default spacing rather than adding to it. A page that lays
   * itself out with `grid gap-*` already spaces its children, and a margin
   * appended to the default would leave two Tailwind margin utilities on one
   * element with the winner decided by stylesheet order rather than by the
   * page.
   */
  className?: string
}

/**
 * Where a back action goes: the last step in the trail that is somewhere to go.
 *
 * Deliberately *not* `history.back()`. The browser's history is where you came
 * from, which on a detail page opened from Home, from a search, or from a
 * notification is not the collection the page belongs to — and the global back
 * gesture already covers "undo my last navigation" (out of scope, #101). This
 * points at the actual parent address instead, so the answer is the same
 * however somebody arrived, and it carries the Group with it because every
 * `AppLink` in the app is built by `groupPaths` (ADR-0002).
 *
 * Reading from the end rather than taking `trail[length - 2]` is what keeps a
 * half-built trail useful: a detail page knows its Module before it knows the
 * thing it is showing, and while that is still loading the collection is the
 * only step there is — and is exactly where back should go.
 */
export function parentCrumb(trail: readonly Crumb[]): Crumb | null {
  for (let index = trail.length - 1; index >= 0; index--) {
    if (trail[index].link) return trail[index]
  }
  return null
}

/**
 * The trail above a nested page, and the way back out of it.
 *
 * Two renderings of one list, chosen by width rather than by two components:
 * a phone gets a single back action to the immediate parent — a full trail is
 * unreadable at that width and its tap targets overlap — and everything wider
 * gets the hierarchy. Both are in the markup at once and one of the two is
 * `display: none`, so the reading order is the same and neither is a second
 * definition of where the page sits.
 *
 * The shell's own navigation is untouched by this. The sidebar, the dock and
 * the topbar say which Module you are in; they render above the route and
 * cannot know that this page is a food, or that food's edit form. This is the
 * only thing in the app that does, because the page builds it.
 */
export function Breadcrumbs({ trail, className = 'mb-4' }: BreadcrumbsProps) {
  const { shell } = useMessages()
  const { breadcrumbs } = shell
  const parent = parentCrumb(trail)

  // A page with no hierarchy above it is a Module's own index, and the shell
  // already names that. Drawing a one-step trail there would be chrome that
  // says nothing.
  if (trail.length === 0) return null

  return (
    <nav aria-label={breadcrumbs.label} className={className}>
      {parent?.link && (
        <Link
          {...parent.link}
          aria-label={fmt(breadcrumbs.backTo, { page: parent.label })}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--app-muted)] no-underline md:hidden"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">{parent.label}</span>
        </Link>
      )}

      <ol className="m-0 hidden list-none flex-wrap items-center gap-1 p-0 text-sm text-[var(--app-muted)] md:flex">
        {trail.map((crumb, index) => (
          <li
            // Two steps of one trail can share a label — a child called after
            // the Module they are in, say — so the position is part of what
            // identifies a row here.
            key={`${index}-${crumb.label}`}
            className="flex min-w-0 items-center gap-1"
          >
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 opacity-60"
                aria-hidden="true"
              />
            )}
            {crumb.link ? (
              <Link
                {...crumb.link}
                className="truncate text-[var(--app-muted)] no-underline hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="truncate font-semibold text-[var(--app-fg)]"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
