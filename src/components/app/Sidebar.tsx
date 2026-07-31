import { Link, useLocation } from '@tanstack/react-router'
import { homeDestination } from '../../lib/appNavigation'
import { groupSlugOf } from '../../lib/groupPaths'
import { GroupSwitcher } from './GroupSwitcher'
import { Icon } from './Icon'
import { Pill } from './ShellPrimitives'
import { useNavigation } from './useNavigation'

export interface SidebarProps {
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

/**
 * Home, your pins, All — and nothing else.
 *
 * The full Module catalog used to live here, grouped into four headed blocks,
 * which is why a household with fourteen Modules had to scroll past ten it
 * never opens. That was never a reason to let a Group switch Modules off:
 * everything stays available, and All is one click away at the bottom of this
 * same list.
 */
export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const isDrawer = variant === 'drawer'
  const { items, activeId } = useNavigation()
  const location = useLocation()

  return (
    <aside
      className={
        isDrawer
          ? 'flex min-h-full flex-col gap-6 overflow-y-auto p-4'
          : 'hidden h-svh w-66 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 md:flex'
      }
      aria-label="Gather navigation"
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Link
          {...homeDestination(groupSlugOf(location.pathname))}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 no-underline"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-sm font-bold text-[var(--app-fg)]">
            G
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm text-[var(--app-fg)]">
              Gather
            </strong>
            <span className="block truncate text-xs text-[var(--app-muted)]">
              Preview group
            </span>
          </span>
        </Link>
        <Link
          to="/groups"
          onClick={onNavigate}
          className="shell-icon-button"
          aria-label="Manage groups"
          title="Manage groups"
        >
          <Icon name="Plus" className="h-4 w-4" />
        </Link>
      </div>

      <GroupSwitcher onNavigate={onNavigate} />

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
            {item.placeholder ? <Pill>Soon</Pill> : null}
            {item.personal ? (
              <span title="Only you can see this. It is the same in every group.">
                <Pill>Only you</Pill>
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <section className="mt-auto rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold">Preview group</h2>
          <Pill tone="warning">Preview data</Pill>
        </div>
        <p className="m-0 text-sm text-[var(--app-muted)]">
          Group and member details appear here once connected.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to="/groups"
            onClick={onNavigate}
            className="text-xs no-underline"
          >
            Groups
          </Link>
          <Link
            to="/settings"
            onClick={onNavigate}
            className="text-xs no-underline"
          >
            Settings
          </Link>
        </div>
      </section>
    </aside>
  )
}
