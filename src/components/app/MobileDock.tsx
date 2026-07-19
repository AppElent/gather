import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { buildMobileDock } from '../../lib/spaceNavigation'
import { spacePath } from '../../lib/spaceRoutes'
import { useSpaceModules } from '../spaces/SpaceContext'

function Icon({ name }: { name: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className="h-4 w-4" aria-hidden="true" />
}

export function MobileDock({
  location,
}: {
  location: { pathname: string; hash?: string }
}) {
  const { space, pinnedModules } = useSpaceModules()
  const byId = new Map(pinnedModules.map((module) => [module.id, module]))
  const destinations = buildMobileDock(pinnedModules.map((module) => module.id))

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-2 bottom-2 z-30 grid grid-flow-col auto-cols-fr gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 md:hidden"
    >
      {destinations.map((destination) => {
        const module = byId.get(destination)
        const path =
          destination === 'home'
            ? spacePath.home(space.slug)
            : destination === 'modules'
              ? spacePath.modules(space.slug)
              : spacePath.module(space.slug, module!.pathSegment)
        const active =
          destination === 'modules'
            ? location.pathname === spacePath.modules(space.slug) ||
              (location.pathname.startsWith(`/s/${space.slug}/`) &&
                !destinations.some((item) => {
                  const target = byId.get(item)
                  return target
                    ? location.pathname ===
                        spacePath.module(space.slug, target.pathSegment)
                    : location.pathname === spacePath.home(space.slug)
                }))
            : location.pathname === path
        return (
          <Link
            key={destination}
            to={path as never}
            aria-current={active ? 'page' : undefined}
            className="grid min-h-11 place-items-center rounded-[7px] text-xs text-[var(--app-muted)] no-underline aria-[current=page]:bg-[var(--app-surface-muted)] aria-[current=page]:text-[var(--app-fg)]"
          >
            <Icon
              name={
                destination === 'home'
                  ? 'House'
                  : destination === 'modules'
                    ? 'Grid2X2'
                    : module!.icon
              }
            />
            <span>
              {destination === 'home'
                ? 'Home'
                : destination === 'modules'
                  ? 'All'
                  : module!.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
