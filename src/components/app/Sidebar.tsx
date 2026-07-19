import { Link, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { spacePath } from '../../lib/spaceRoutes'
import { useSpaceModules } from '../spaces/SpaceContext'
import { SpaceSwitcher } from '../spaces/SpaceSwitcher'

function Icon({ name }: { name: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className="h-4 w-4" aria-hidden="true" />
}

export interface SidebarProps {
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const { space, role, visibleModules, pinnedModules } = useSpaceModules()
  const location = useLocation()
  const isDrawer = variant === 'drawer'
  const itemClass = (active: boolean) =>
    `grid min-h-10 grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline ${
      active ? 'border-[var(--app-fg)] bg-[var(--app-surface)]' : ''
    }`
  const isModuleRoute = (moduleId: string) =>
    location.pathname === spacePath.module(space.slug, moduleId)
  const unpinnedModules = visibleModules.filter(
    (module) => !pinnedModules.some((pinned) => pinned.id === module.id),
  )
  const allIsActive =
    location.pathname === spacePath.modules(space.slug) ||
    unpinnedModules.some((module) => isModuleRoute(module.pathSegment))

  return (
    <aside
      className={
        isDrawer
          ? 'flex min-h-full flex-col gap-6 overflow-y-auto p-4'
          : 'hidden h-svh w-66 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 md:flex'
      }
      aria-label="Space navigation"
    >
      <SpaceSwitcher />
      <nav className="grid gap-1" aria-label="Primary">
        <Link
          to="/s/$spaceSlug/home"
          params={{ spaceSlug: space.slug }}
          onClick={onNavigate}
          className={itemClass(
            location.pathname === spacePath.home(space.slug),
          )}
        >
          <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon name="House" />
          </span>
          <span>Home</span>
        </Link>
        {pinnedModules.map((module) => (
          <Link
            key={module.id}
            to={spacePath.module(space.slug, module.pathSegment) as never}
            onClick={onNavigate}
            className={itemClass(isModuleRoute(module.pathSegment))}
          >
            <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
              <Icon name={module.icon} />
            </span>
            <span className="truncate">{module.label}</span>
          </Link>
        ))}
        <Link
          to="/s/$spaceSlug/modules"
          params={{ spaceSlug: space.slug }}
          onClick={onNavigate}
          className={itemClass(allIsActive)}
        >
          <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon name="Grid2X2" />
          </span>
          <span>All</span>
        </Link>
      </nav>
      {role === 'admin' ? (
        <nav className="mt-auto grid gap-1" aria-label="Space administration">
          <Link
            to="/s/$spaceSlug/members"
            params={{ spaceSlug: space.slug }}
            onClick={onNavigate}
            className={itemClass(
              location.pathname === spacePath.members(space.slug),
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
              <Icon name="Users" />
            </span>
            <span>Members</span>
          </Link>
          <Link
            to="/s/$spaceSlug/settings"
            params={{ spaceSlug: space.slug }}
            onClick={onNavigate}
            className={itemClass(
              location.pathname.startsWith(spacePath.settings(space.slug)),
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
              <Icon name="Settings" />
            </span>
            <span>Settings</span>
          </Link>
        </nav>
      ) : null}
    </aside>
  )
}
