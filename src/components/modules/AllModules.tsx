import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { spacePath } from '../../lib/spaceRoutes'
import { useSpaceModules } from '../spaces/SpaceContext'

function Icon({ name }: { name: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className="h-5 w-5" aria-hidden="true" />
}

function useCompactLayout() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isCompact
}

export function AllModules() {
  const { space, role, visibleModules, pinnedModules } = useSpaceModules()
  const isCompact = useCompactLayout()
  const [query, setQuery] = useState('')
  const modules = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return visibleModules
    return visibleModules.filter(
      (module) =>
        module.label.toLowerCase().includes(normalized) ||
        module.description.toLowerCase().includes(normalized),
    )
  }, [query, visibleModules])
  const overflowModules = isCompact
    ? pinnedModules.slice(3).filter((module) => modules.includes(module))
    : []
  const overflowModuleIds = new Set(overflowModules.map((module) => module.id))
  const gridModules = isCompact
    ? modules.filter((module) => !overflowModuleIds.has(module.id))
    : modules

  return (
    <section className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-semibold uppercase text-[var(--app-muted)]">
            {space.name ?? 'Space'}
          </p>
          <h1 className="m-0 text-2xl font-semibold">All modules</h1>
        </div>
        {role === 'admin' ? (
          <Link
            to="/s/$spaceSlug/settings/modules"
            params={{ spaceSlug: space.slug }}
            className="text-sm font-semibold text-[var(--app-fg)]"
          >
            Manage modules
          </Link>
        ) : null}
      </header>
      <label className="grid gap-1 text-sm font-semibold">
        Find a module
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules"
          className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal"
        />
      </label>
      {overflowModules.length ? (
        <section className="grid gap-3">
          <h2 className="m-0 text-lg font-semibold">More from your menu</h2>
          <div className="grid gap-2">
            {overflowModules.map((module) => (
              <Link
                key={module.id}
                to={spacePath.module(space.slug, module.pathSegment) as never}
                className="rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-2 text-sm font-semibold text-[var(--app-fg)] no-underline"
              >
                {module.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {modules.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gridModules.map((module) => (
            <Link
              key={module.id}
              aria-label={module.label}
              to={spacePath.module(space.slug, module.pathSegment) as never}
              className="grid min-h-32 content-between rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-[var(--app-fg)] no-underline transition hover:border-[var(--app-fg)]"
            >
              <Icon name={module.icon} />
              <span>
                <strong className="block">{module.label}</strong>
                <span className="mt-1 block text-sm text-[var(--app-muted)]">
                  {module.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-[var(--app-muted)]">
          No enabled modules match that search.
        </p>
      )}
    </section>
  )
}
