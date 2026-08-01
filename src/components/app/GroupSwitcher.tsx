import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  groupIndexSurfaceOf,
  groupLink,
  groupSlugOf,
} from '../../lib/groupPaths'
import { Icon } from './Icon'
import { Pill } from './ShellPrimitives'

export interface GroupSwitcherProps {
  onNavigate?: () => void
}

/**
 * The Group you are in, at the top of the sidebar, and the way to leave it.
 *
 * Naming the Group and switching it are the same control on purpose. A list of
 * Groups sitting below a masthead that said something else made the current
 * Group a thing you inferred from which row was highlighted; the first line of
 * the sidebar is where a reader already looks to answer "where am I?".
 *
 * Move between Groups by going somewhere, not by changing a setting. Switching
 * used to mean writing a default onto your account, which made the Group
 * invisible and global: two tabs could not disagree, and a link could not carry
 * it. These are ordinary links, so the Group lives in the URL and each tab keeps
 * its own (ADR-0002).
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
  const current = groups?.find((group) => group.slug === currentSlug)

  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // A menu that outlives the click that dismissed it is a menu you have to
  // close twice. Every way out of it closes it: its own links say so, a click
  // anywhere else counts as one, and Escape is the keyboard's version.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch group"
        className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-left"
      >
        <span className="grid h-8 w-8 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-sm font-bold text-[var(--app-fg)]">
          G
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-sm text-[var(--app-fg)]">
            {/* Not "Gather": the app's name is the one thing on this screen
                nobody needs telling. */}
            {current?.name ?? (groups === undefined ? 'Loading…' : 'No group')}
          </strong>
          <span className="block truncate text-xs text-[var(--app-muted)]">
            {current
              ? current.isPersonal
                ? 'Your own group'
                : 'Shared group'
              : 'Pick a group'}
          </span>
        </span>
        <Icon
          name={open ? 'ChevronUp' : 'ChevronDown'}
          className="h-4 w-4 text-[var(--app-muted)]"
        />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1 grid gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg">
          {groups?.map((group) => (
            <Link
              key={group._id}
              {...groupLink(surface, group.slug)}
              onClick={() => {
                setOpen(false)
                onNavigate?.()
              }}
              aria-current={group.slug === currentSlug ? 'true' : undefined}
              className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] px-2 text-sm font-semibold text-[var(--app-fg)] no-underline aria-[current]:bg-[var(--app-surface-muted)]"
            >
              <span className="truncate">{group.name}</span>
              {group.isPersonal ? <Pill>Personal</Pill> : null}
            </Link>
          ))}
          <Link
            to="/groups"
            onClick={() => {
              setOpen(false)
              onNavigate?.()
            }}
            className="grid min-h-9 items-center rounded-[7px] border-t border-[var(--app-border)] px-2 text-sm text-[var(--app-muted)] no-underline"
          >
            Manage groups
          </Link>
        </div>
      ) : null}
    </div>
  )
}
