import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { formatAge } from '../../lib/babyDate'
import { SurfaceCard } from '../app/ShellPrimitives'
import type { BabyNav } from './babyNav'

export interface BabyListPageProps {
  /**
   * The Group whose log this is, when there is one in the URL. Undefined on the
   * flat route, where the answer still comes from the account's default group.
   */
  groupSlug?: string
  nav: BabyNav
}

/**
 * The children in one household's log, whole. Rendered by both `/baby` and
 * `/g/<slug>/baby`.
 *
 * The Group arrives as a prop and goes straight to Convex, which resolves it
 * through the one Group-scoped check. Under `/g/<slug>/baby` the answer is that
 * Group's children and nobody else's; on the flat route it is still whatever
 * `defaultGroupId` says, which is exactly the dependency #24 removes when the
 * flat routes go.
 */
export function BabyListPage({ groupSlug, nav }: BabyListPageProps) {
  const babies = useQuery(api.babies.list, groupSlug ? { groupSlug } : {})

  if (babies === null) {
    return (
      <div className="mx-auto max-w-md">
        <SurfaceCard>
          <div className="grid gap-2 text-center">
            <h2 className="m-0 text-base font-semibold">
              Pick a default group first
            </h2>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              The baby log belongs to a group. Choose or create one, then come
              back.
            </p>
            <Link to="/groups" className="text-sm font-semibold">
              Go to groups
            </Link>
          </div>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-2xl font-semibold">Baby log</h2>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Temperature, feeding, sleep, growth and more — shared with the
            group.
          </p>
        </div>
        <Link
          {...nav.create}
          className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm font-semibold text-[var(--app-fg)] no-underline"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add child
        </Link>
      </div>

      {babies === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
            />
          ))}
        </div>
      ) : babies.length === 0 ? (
        <SurfaceCard>
          <div className="grid gap-3 text-center">
            <h3 className="m-0 text-base font-semibold">No children yet</h3>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              Add a child to start logging temperature, feeding, sleep and more.
            </p>
            <Link
              {...nav.create}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
            >
              Add your first child
            </Link>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {babies.map((b) => (
            <Link
              key={b._id}
              {...nav.detail(b._id)}
              className="block no-underline transition hover:opacity-90"
            >
              <SurfaceCard>
                <div className="flex items-center gap-3">
                  {b.photoUrl ? (
                    <img
                      src={b.photoUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--app-surface-muted)]" />
                  )}
                  <div className="min-w-0">
                    <h3 className="m-0 truncate text-base font-semibold text-[var(--app-fg)]">
                      {b.name}
                    </h3>
                    <p className="m-0 text-sm text-[var(--app-muted)]">
                      {formatAge(b.birthDate)}
                    </p>
                  </div>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
