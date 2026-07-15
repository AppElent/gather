import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { PRIMARY_AREAS } from '../../lib/appNavigation'
import { MODULE_GROUPS, modulesByGroup } from '../../lib/modules'
import { AvatarStack, Pill } from './ShellPrimitives'

function Icon({ name, className }: { name: string; className?: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className={className} aria-hidden="true" />
}

export interface SidebarProps {
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const byGroup = modulesByGroup()
  const isDrawer = variant === 'drawer'

  return (
    <aside
      className={
        isDrawer
          ? 'flex h-full flex-col gap-6 p-4'
          : 'hidden h-svh w-66 shrink-0 flex-col gap-6 border-r border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 md:flex'
      }
      aria-label="Gather navigation"
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Link
          to="/dashboard"
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
              Oak House
            </span>
          </span>
        </Link>
        <button
          type="button"
          className="shell-icon-button"
          aria-label="Create group item"
        >
          <Icon name="Plus" className="h-4 w-4" />
        </button>
      </div>

      <nav className="grid gap-1" aria-label="Primary">
        <p className="m-0 px-2 pb-1 text-[11px] font-semibold uppercase text-[var(--app-muted)]">
          Today
        </p>
        {PRIMARY_AREAS.map((item) => (
          <Link
            key={item.id}
            to={item.path as LinkProps['to']}
            onClick={onNavigate}
            className="grid min-h-10 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline"
            activeProps={{
              className:
                'border-[var(--app-fg)] bg-[var(--app-surface)] text-[var(--app-fg)]',
            }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
              <Icon name={item.icon} className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <nav className="grid gap-3" aria-label="Modules">
        {MODULE_GROUPS.map((group) => (
          <div key={group} className="grid gap-1">
            <p className="m-0 px-2 pb-1 text-[11px] font-semibold uppercase text-[var(--app-muted)]">
              {group}
            </p>
            {byGroup[group].map((module) => (
              <Link
                key={module.id}
                to={module.path as LinkProps['to']}
                onClick={onNavigate}
                className="grid min-h-9 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline"
                activeProps={{
                  className: 'border-[var(--app-fg)] bg-[var(--app-surface)]',
                }}
              >
                <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
                  <Icon name={module.icon} className="h-4 w-4" />
                </span>
                <span className="truncate">{module.label}</span>
                {module.status === 'placeholder' ? <Pill>Soon</Pill> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <section className="mt-auto rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold">Active group</h2>
          <Pill tone="success">synced</Pill>
        </div>
        <AvatarStack members={['Alex', 'Maya']} />
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
