import { formatAge } from '@gather/core/baby-age'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { SurfaceCard } from '../app/ShellPrimitives'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { WashHeader } from '../app/WashHeader'

/**
 * The children in the Current Group's log, whole: that Group's children and
 * nobody else's.
 */
export function BabyListPage() {
  const group = useRequiredCurrentGroup()
  const { slug: groupSlug, timeZone } = group
  const babies = useQuery(api.babies.list, { groupSlug })
  const { locale, messages } = useI18n()
  const { child, list } = messages.baby.log

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-4">
      <WashHeader
        group="home"
        icon="Baby"
        title={messages.modules.byId['baby-log'].label}
        summary={
          babies
            ? {
                count: plural(locale, babies.length, list.count),
                scope: group.name,
              }
            : undefined
        }
        back={{ label: messages.shell.allModules.title, link: linkTo('all') }}
        settings={linkTo('babySettings')}
        primary={{ label: list.addChild, link: linkTo('newChild') }}
      />

      {babies === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : babies.length === 0 ? (
        <SurfaceCard>
          <div className="grid gap-3 text-center">
            <h3 className="m-0 text-base font-semibold">{list.emptyTitle}</h3>
            <p className="m-0 text-sm text-[var(--muted)]">
              {list.emptyBody}
            </p>
            <Link
              {...linkTo('newChild')}
              className="mx-auto inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-[var(--hair)] px-3 text-sm font-semibold no-underline"
            >
              {list.emptyAction}
            </Link>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {babies.map((b) => (
            <Link
              key={b._id}
              {...linkTo('child', { babyId: b._id })}
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
                    <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--surface-2)]" />
                  )}
                  <div className="min-w-0">
                    <h3 className="m-0 truncate text-base font-semibold text-[var(--ink)]">
                      {b.name}
                    </h3>
                    <p className="m-0 text-sm text-[var(--muted)]">
                      {formatAge(b.birthDate, child.age, locale, undefined, timeZone)}
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
