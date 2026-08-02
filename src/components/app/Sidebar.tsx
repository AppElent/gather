import { Link } from '@tanstack/react-router'
import { groupLink } from '../../lib/groupPaths'
import { GroupSwitcher } from './GroupSwitcher'
import { Icon } from './Icon'
import { Pill } from './ShellPrimitives'
import { useCurrentGroup } from './useCurrentGroup'
import { useNavigation } from './useNavigation'

export interface SidebarProps {
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

const FOOTER_LINK =
  'grid min-h-9 items-center rounded-[var(--app-radius)] px-2 text-sm text-[var(--app-muted)] no-underline'

/**
 * Home, your pins, All — and nothing else.
 *
 * The full Module catalog used to live here, grouped into four headed blocks,
 * which is why a household with fourteen Modules had to scroll past ten it
 * never opens. That was never a reason to let a Group switch Modules off:
 * everything stays available, and All is one click away at the bottom of this
 * same list.
 *
 * Off a Group route — Settings, Account, the Groups list — there is no list to
 * render, and the sidebar says that in a sentence rather than showing rows that
 * would each have to pick a Group for you. The switcher above it already reads
 * "No group / Pick a group", and picking one is the way out.
 *
 * At the bottom, the pages that are not a Module: the Group's own settings when
 * there is a Group, then Groups and your own Settings, which are about you and
 * read the same from everywhere.
 */
export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const isDrawer = variant === 'drawer'
  const { items, activeId } = useNavigation()
  // Resolved against the Groups you are in rather than taken off the URL raw,
  // so the Group settings link is only offered for a slug that leads somewhere.
  const { current } = useCurrentGroup()

  return (
    <aside
      className={
        isDrawer
          ? 'flex min-h-full flex-col gap-6 overflow-y-auto p-4'
          : 'hidden h-svh w-66 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 md:flex'
      }
      aria-label="Gather navigation"
    >
      <GroupSwitcher onNavigate={onNavigate} />

      {items.length === 0 ? (
        <p className="m-0 px-2 text-sm leading-6 text-[var(--app-muted)]">
          Pick a group to see its modules.
        </p>
      ) : (
        <nav className="grid gap-1" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.id}
              {...item.link}
              onClick={onNavigate}
              aria-current={item.id === activeId ? 'page' : undefined}
              className={`grid min-h-10 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline ${
                item.id === activeId
                  ? 'border-[var(--app-fg)] bg-[var(--app-surface)]'
                  : ''
              }`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {item.placeholder ? <Pill>Soon</Pill> : null}
                {item.personal ? (
                  <span title="Only you can see this. It is the same in every group.">
                    <Pill>Only you</Pill>
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* The pages that are not a Module. This used to be a card headed
          "Preview group" over a sentence promising that group and member
          details would appear once connected — a promise Home now keeps, on a
          page, with real names on it. What was worth keeping is the three
          links, which are the only way to leave a Group from the sidebar. */}
      <nav className="mt-auto grid gap-1" aria-label="Settings and groups">
        {current ? (
          <Link
            {...groupLink('settings', current.slug)}
            onClick={onNavigate}
            className={FOOTER_LINK}
          >
            Group settings
          </Link>
        ) : null}
        <Link to="/groups" onClick={onNavigate} className={FOOTER_LINK}>
          Groups
        </Link>
        <Link to="/settings" onClick={onNavigate} className={FOOTER_LINK}>
          Settings
        </Link>
      </nav>
    </aside>
  )
}
