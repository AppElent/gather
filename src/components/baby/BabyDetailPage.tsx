import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatAge } from '../../lib/babyDate'
import { useI18n } from '../../lib/i18n'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { SurfaceCard } from '../app/ShellPrimitives'
import { BabyChecklistCard } from './BabyChecklistCard'
import { BabySwitcher } from './BabySwitcher'
import type { BabyNav } from './babyNav'
import { ExportPdfButton } from './ExportPdfButton'
import { ExportPdfPanel } from './ExportPdfPanel'
import { QuickLogButtons } from './QuickLogButtons'
import { Timeline } from './Timeline'
import { TrendChart } from './TrendChart'

export interface BabyDetailPageProps {
  babyId: string
  /** The Group the URL claims this child is in. */
  groupSlug: string
  nav: BabyNav
}

/**
 * One child's log, whole.
 *
 * The id and the slug are checked against each other rather than separately: a
 * child from another household reads as "not found" here even when the caller
 * could see it from a Group of their own, because the URL is claiming something
 * about this child and this Group that is not true.
 */
export function BabyDetailPage({
  babyId,
  groupSlug,
  nav,
}: BabyDetailPageProps) {
  const id = babyId as Id<'babies'>
  const baby = useQuery(api.babies.get, { id, groupSlug })
  const babies = useQuery(api.babies.list, { groupSlug })
  const [exportOpen, setExportOpen] = useState(false)
  // Skip until the baby has actually loaded — firing this unconditionally
  // means a deleted/inaccessible id makes requireBabyAccess throw instead
  // of falling through to the "Child not found" state below.
  const events = useQuery(
    api.babyEvents.listByBaby,
    baby ? { babyId: id, groupSlug } : 'skip',
  )
  const ensureTodoList = useMutation(api.babies.ensureTodoList)
  const ensureQuestionsList = useMutation(api.babies.ensureQuestionsList)
  const { locale, messages } = useI18n()
  const { child } = messages.baby.log

  useEffect(() => {
    if (baby && !baby.taskListId)
      void ensureTodoList({ id: baby._id, groupSlug })
  }, [baby, groupSlug, ensureTodoList])

  useEffect(() => {
    if (baby && !baby.questionsListId) {
      void ensureQuestionsList({ id: baby._id, groupSlug })
    }
  }, [baby, groupSlug, ensureQuestionsList])

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

  // Baby log → this child. The switcher below moves sideways between the
  // children of one household; this is the step up out of them.
  const trail: Crumb[] = [
    { label: messages.modules.byId['baby-log'].label, link: nav.list },
    ...(baby ? [{ label: baby.name }] : []),
  ]

  if (baby === undefined)
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{messages.common.errors.loading}</p>
      </div>
    )
  if (baby === null)
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm opacity-60">{child.notFound}</p>
      </div>
    )

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      {/* The grid above already spaces its children. */}
      <Breadcrumbs trail={trail} className="" />
      {baby.taskListId && (
        <BabyChecklistCard
          taskListId={baby.taskListId}
          groupSlug={groupSlug}
          title={child.todo}
          placeholder={child.todoPlaceholder}
        />
      )}
      {baby.questionsListId && (
        <BabyChecklistCard
          taskListId={baby.questionsListId}
          groupSlug={groupSlug}
          title={child.questions}
          placeholder={child.questionsPlaceholder}
          collapsible
        />
      )}

      {babies && <BabySwitcher babies={babies} activeId={id} nav={nav} />}

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
              {formatAge(baby.birthDate, child.age, locale)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportPdfButton onClick={() => setExportOpen(true)} />
          <Link
            {...nav.edit(id)}
            className="inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold no-underline"
          >
            {messages.common.actions.edit}
          </Link>
        </div>
      </div>

      {exportOpen && (
        <ExportPdfPanel
          babyId={id}
          groupSlug={groupSlug}
          babyName={baby.name}
          babyBirthDate={baby.birthDate}
          onClose={() => setExportOpen(false)}
        />
      )}

      <QuickLogButtons babyId={id} groupSlug={groupSlug} />

      {(temperaturePoints.length > 0 || weightPoints.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {temperaturePoints.length > 0 && (
            <SurfaceCard>
              <h2 className="m-0 mb-2 text-sm font-semibold">
                {child.temperatureTrend}
              </h2>
              <TrendChart points={temperaturePoints} unit="°C" />
            </SurfaceCard>
          )}
          {weightPoints.length > 0 && (
            <SurfaceCard>
              <h2 className="m-0 mb-2 text-sm font-semibold">
                {child.weightTrend}
              </h2>
              <TrendChart points={weightPoints} unit="kg" />
            </SurfaceCard>
          )}
        </div>
      )}

      {events === undefined ? (
        <div className="h-40 animate-pulse rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)]" />
      ) : (
        <Timeline babyId={id} groupSlug={groupSlug} events={events} />
      )}
    </div>
  )
}
