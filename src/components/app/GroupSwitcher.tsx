import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  groupIndexSurfaceOf,
  groupLink,
  groupSlugOf,
} from '../../lib/groupPaths'
import { Pill } from './ShellPrimitives'

export interface GroupSwitcherProps {
  onNavigate?: () => void
}

/**
 * Move between your Groups by going somewhere, not by changing a setting.
 *
 * Switching used to mean writing a default onto your account, which made the
 * Group invisible and global: two tabs could not disagree, and a link could not
 * carry it. These are ordinary links, so the Group lives in the URL and each tab
 * keeps its own (ADR-0002).
 *
 * Where a switch lands: the same Module in the chosen Group when that Module has
 * a Group-scoped route, and the Group's landing page otherwise — including from
 * any flat route, which has no Group in it to preserve.
 *
 * The Module's *index*, never the page you were on: a recipe id, a food id or a
 * child names something that lives in one Group, so carrying it into another
 * would ask for content that Group does not have.
 */
export function GroupSwitcher({ onNavigate }: GroupSwitcherProps) {
  const groups = useQuery(api.groups.myGroups)
  const location = useLocation()
  const currentSlug = groupSlugOf(location.pathname)
  const surface = groupIndexSurfaceOf(location.pathname) ?? 'home'

  return (
    <nav className="grid gap-1" aria-label="Groups">
      <p className="m-0 px-2 pb-1 text-[11px] font-semibold uppercase text-[var(--app-muted)]">
        Groups
      </p>
      {groups === undefined ? (
        <p className="m-0 px-2 text-sm text-[var(--app-muted)]">Loading…</p>
      ) : (
        groups.map((group) => (
          <Link
            key={group._id}
            {...groupLink(surface, group.slug)}
            onClick={onNavigate}
            className={`grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline ${
              group.slug === currentSlug
                ? 'border-[var(--app-fg)] bg-[var(--app-surface)]'
                : ''
            }`}
          >
            <span className="truncate">{group.name}</span>
            {group.isPersonal ? <Pill>Personal</Pill> : null}
          </Link>
        ))
      )}
    </nav>
  )
}
