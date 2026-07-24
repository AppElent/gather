import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { SurfaceCard } from '../../../components/app/ShellPrimitives'
import { BabyChecklistCard } from '../../../components/baby/BabyChecklistCard'
import { BabySwitcher } from '../../../components/baby/BabySwitcher'
import { ExportPdfButton } from '../../../components/baby/ExportPdfButton'
import { ExportPdfPanel } from '../../../components/baby/ExportPdfPanel'
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
  const [exportOpen, setExportOpen] = useState(false)
  // Skip until the baby has actually loaded — firing this unconditionally
  // means a deleted/inaccessible id makes requireBabyAccess throw instead
  // of falling through to the "Child not found" state below.
  const events = useQuery(
    api.babyEvents.listByBaby,
    baby ? { babyId: id } : 'skip',
  )
  const ensureTodoList = useMutation(api.babies.ensureTodoList)
  const ensureQuestionsList = useMutation(api.babies.ensureQuestionsList)

  useEffect(() => {
    if (baby && !baby.taskListId) void ensureTodoList({ id: baby._id })
  }, [baby, ensureTodoList])

  useEffect(() => {
    if (baby && !baby.questionsListId) {
      void ensureQuestionsList({ id: baby._id })
    }
  }, [baby, ensureQuestionsList])

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
      {baby.taskListId && (
        <BabyChecklistCard
          taskListId={baby.taskListId}
          title="To-do"
          placeholder="Buy diapers, call pediatrician…"
        />
      )}
      {baby.questionsListId && (
        <BabyChecklistCard
          taskListId={baby.questionsListId}
          title="Questions"
          placeholder="Ask about sleep regression…"
          collapsible
        />
      )}

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
        <div className="flex flex-wrap gap-2">
          <ExportPdfButton onClick={() => setExportOpen(true)} />
          <Link
            to="/baby/$babyId/edit"
            params={{ babyId: id }}
            className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
          >
            Edit
          </Link>
        </div>
      </div>

      {exportOpen && (
        <ExportPdfPanel
          babyId={id}
          babyName={baby.name}
          babyBirthDate={baby.birthDate}
          onClose={() => setExportOpen(false)}
        />
      )}

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
