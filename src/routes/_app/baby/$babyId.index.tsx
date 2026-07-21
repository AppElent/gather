import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { SurfaceCard } from '../../../components/app/ShellPrimitives'
import { BabySwitcher } from '../../../components/baby/BabySwitcher'
import { ExportPdfButton } from '../../../components/baby/ExportPdfButton'
import { QuickLogButtons } from '../../../components/baby/QuickLogButtons'
import { Timeline } from '../../../components/baby/Timeline'
import { TrendChart } from '../../../components/baby/TrendChart'
import { formatAge } from '../../../lib/babyDate'

export const Route = createFileRoute('/_app/baby/$babyId/')({
  component: BabyDetail,
})

function BabyDetail() {
  const { babyId } = Route.useParams()
  const id = babyId as Id<'babies'>
  const baby = useQuery(api.babies.get, { id })
  const babies = useQuery(api.babies.list)
  const events = useQuery(api.babyEvents.listByBaby, { babyId: id })

  const temperaturePoints = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.type === 'temperature')
        .map((e) => ({
          x: e.timestamp,
          y: (e.data as { celsius: number }).celsius,
        })),
    [events],
  )

  const weightPoints = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.type === 'growth')
        .map((e) => ({
          x: e.timestamp,
          y: (e.data as { weightKg?: number }).weightKg,
        }))
        .filter((p): p is { x: number; y: number } => p.y !== undefined),
    [events],
  )

  if (baby === undefined) return <p className="text-sm opacity-60">Loading…</p>
  if (baby === null)
    return <p className="text-sm opacity-60">Child not found.</p>

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      {babies && <BabySwitcher babies={babies} activeId={id} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {baby.photoUrl ? (
            <img
              src={baby.photoUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-[var(--app-surface-muted)]" />
          )}
          <div>
            <h1 className="m-0 text-2xl font-semibold">{baby.name}</h1>
            <p className="m-0 text-sm text-[var(--app-muted)]">
              {formatAge(baby.birthDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportPdfButton
            babyId={id}
            babyName={baby.name}
            babyBirthDate={baby.birthDate}
          />
          <Link
            to="/baby/$babyId/edit"
            params={{ babyId: id }}
            className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
          >
            Edit
          </Link>
        </div>
      </div>

      <QuickLogButtons babyId={id} />

      {(temperaturePoints.length > 0 || weightPoints.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {temperaturePoints.length > 0 && (
            <SurfaceCard>
              <h2 className="m-0 mb-2 text-sm font-semibold">
                Temperature trend
              </h2>
              <TrendChart points={temperaturePoints} unit="°C" />
            </SurfaceCard>
          )}
          {weightPoints.length > 0 && (
            <SurfaceCard>
              <h2 className="m-0 mb-2 text-sm font-semibold">Weight trend</h2>
              <TrendChart points={weightPoints} unit="kg" />
            </SurfaceCard>
          )}
        </div>
      )}

      {events === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
      ) : (
        <Timeline babyId={id} events={events} />
      )}
    </div>
  )
}
