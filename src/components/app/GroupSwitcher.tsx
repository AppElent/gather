import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMessages } from '../../lib/i18n'
import { indexSurfaceOf, linkTo } from '../../lib/links'
import { Icon } from './Icon'
import { useCurrentGroup } from './useCurrentGroup'

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
 * A row does two things: its click handler makes that Group the Current Group
 * (ADR-0031), and its link says where to land. No link names a Group, so the
 * handler is what switches.
 *
 * Where a switch lands: the same Module index in the chosen Group, and the
 * Group's landing page from anywhere that is not under one, such as
 * `/settings`.
 *
 * The Module's *index*, never the page you were on: a recipe id, a food id or a
 * child names something that lives in one Group, so carrying it into another
 * would ask for content that Group does not have.
 */
export function GroupSwitcher({ onNavigate }: GroupSwitcherProps) {
  const location = useLocation()
  const messages = useMessages()
  const { groupSwitcher } = messages.shell
  const { loading } = messages.common.errors
  const { current, groups, setCurrentGroup } = useCurrentGroup()
  const surface = indexSurfaceOf(location.pathname) ?? 'home'

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
        aria-label={groupSwitcher.label}
        className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-left"
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-sm font-bold text-[var(--app-fg)]">
          {current?.imageUrl ? (
            <img
              src={current.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : current?.icon ? (
            <Icon name={current.icon} className="h-4 w-4" />
          ) : (
            (current?.name.slice(0, 1).toUpperCase() ?? 'G')
          )}
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-sm text-[var(--app-fg)]">
            {/* Not "Gather": the app's name is the one thing on this screen
                nobody needs telling. */}
            {current?.name ??
              (groups === undefined ? loading : groupSwitcher.none)}
          </strong>
          <span className="block truncate text-xs text-[var(--app-muted)]">
            {current ? groupSwitcher.shared : groupSwitcher.pick}
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
              {...linkTo(surface)}
              onClick={() => {
                setCurrentGroup(group._id)
                setOpen(false)
                onNavigate?.()
              }}
              aria-current={group._id === current?._id ? 'true' : undefined}
              className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] px-2 text-sm font-semibold text-[var(--app-fg)] no-underline aria-[current]:bg-[var(--app-surface-muted)]"
            >
              <span className="truncate">{group.name}</span>
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
            {groupSwitcher.manage}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
