import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronsUpDown, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { plural, useI18n } from '../../lib/i18n'
import { indexSurfaceOf, linkTo } from '../../lib/links'
import { Icon } from './Icon'
import { useCurrentGroup } from './useCurrentGroup'

export interface GroupSwitcherProps {
  /** `sidebar`: the card at its top. `round`: the 44 px button a phone-width page carries. */
  variant?: 'sidebar' | 'round'
}

/**
 * The Group you are in, at the top of the sidebar, and the way to leave it.
 *
 * Naming the Group and switching it are the same control on purpose. A list of
 * Groups sitting below a masthead that said something else made the current
 * Group a thing you inferred from which row was highlighted; the first line of
 * the sidebar is where a reader already looks to answer "where am I?". At
 * phone width there is no sidebar, so the same list hangs off a round button
 * at the top of the page.
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
export function GroupSwitcher({ variant = 'sidebar' }: GroupSwitcherProps) {
  const location = useLocation()
  const { locale, messages } = useI18n()
  const { groupSwitcher, today } = messages.shell
  const { loading } = messages.common.errors
  const { current, groups, setCurrentGroup } = useCurrentGroup()
  const members = useQuery(
    api.groups.members,
    current ? { slug: current.slug } : 'skip',
  )
  const surface = indexSurfaceOf(location.pathname) ?? 'home'

  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  // A menu that outlives the click that dismissed it is a menu you have to
  // close twice. Every way out of it closes it: its own links say so, a click
  // anywhere else counts as one, and Escape is the keyboard's version, which
  // hands focus back to the button it came from.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const subtitle = current
    ? members === undefined
      ? groupSwitcher.shared
      : plural(locale, members.length, today.members)
    : groupSwitcher.pick

  return (
    <div ref={root} className="relative">
      {variant === 'sidebar' ? (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-expanded={open}
          aria-label={groupSwitcher.label}
          className="flex h-[52px] w-full items-center gap-2.5 rounded-[14px] bg-[var(--surface)] px-2.5 text-left text-[var(--ink)]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--ink)] text-[15px] font-bold text-[var(--on-ink)]">
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
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-[15px] font-semibold">
              {/* Not "Gather": the app's name is the one thing on this screen
                  nobody needs telling. */}
              {current?.name ??
                (groups === undefined ? loading : groupSwitcher.none)}
            </span>
            <span className="truncate text-[13px] text-[var(--muted)]">
              {subtitle}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      ) : (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-expanded={open}
          aria-label={groupSwitcher.label}
          className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)] text-[var(--ink)]"
        >
          <Users className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}

      {open ? (
        <div
          className={`absolute top-full z-40 mt-1 grid gap-0.5 rounded-[var(--radius-card)] border border-[var(--hair)] bg-[var(--surface)] p-1.5 shadow-lg ${
            variant === 'sidebar' ? 'inset-x-0' : 'left-0 w-64'
          }`}
        >
          {groups?.map((group) => (
            <Link
              key={group._id}
              {...linkTo(surface)}
              onClick={() => {
                setCurrentGroup(group._id)
                setOpen(false)
              }}
              aria-current={group._id === current?._id ? 'true' : undefined}
              className="flex min-h-11 items-center rounded-[var(--radius-control)] px-2.5 text-[15px] text-[var(--ink)] no-underline hover:bg-[var(--surface-2)] aria-[current]:bg-[var(--surface-2)] aria-[current]:font-semibold"
            >
              <span className="truncate">{group.name}</span>
            </Link>
          ))}
          <Link
            {...linkTo('groups')}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-[var(--radius-control)] border-t border-[var(--hair)] px-2.5 text-[15px] text-[var(--muted)] no-underline hover:bg-[var(--surface-2)]"
          >
            {groupSwitcher.manage}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
