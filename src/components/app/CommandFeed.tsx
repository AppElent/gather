import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { getModulesByStatus } from '../../lib/appNavigation'
import { MODULES } from '../../lib/modules'
import { GroupInspector } from './GroupInspector'
import { Pill, SectionHeader, SurfaceCard } from './ShellPrimitives'

const PREVIEW_ACTIVITY = [
  {
    label: 'Recipe changes',
    detail: 'Connected recipe edits and notes will appear here.',
  },
  {
    label: 'Shared updates',
    detail: 'Group-wide changes will stack into a readable timeline.',
  },
] as const

const PREVIEW_UPCOMING = [
  'Meals and grocery checkpoints',
  'Calendar holds and reminders',
] as const

const PREVIEW_ACTIONS = [
  'Suggested follow-ups from module activity',
  'Prompted check-ins for shared planning',
] as const

function Icon({ name }: { name: string }) {
  const Component =
    (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Square
  return <Component className="h-4 w-4" aria-hidden="true" />
}

export function CommandFeed() {
  const byStatus = getModulesByStatus()

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <section className="grid gap-3">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--app-muted)]">
            Designed preview
          </p>
          <h2 className="m-0 text-2xl font-semibold">Group command center</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">
            A shared view of plans, module updates, and suggested next actions.
            This feed is a designed coordination surface; real automation comes
            later.
          </p>
        </div>

        <SurfaceCard>
          <SectionHeader
            title="Gather summary"
            action={<Pill tone="warning">Preview</Pill>}
          />
          <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
            Recipes is live. {byStatus.placeholder.length} other modules are
            staged as placeholders, so the group can see what is planned without
            losing the current working flows.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="dark">Recipes live</Pill>
            <Pill>{MODULES.length} modules</Pill>
            <Pill>Group scoped</Pill>
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-3">
        <SectionHeader
          title="Activity"
          action={<Pill tone="warning">Preview</Pill>}
        />
        <SurfaceCard>
          <div className="grid gap-3">
            {PREVIEW_ACTIVITY.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 border-t border-[var(--app-border)] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <h3 className="m-0 text-sm font-semibold">{item.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">
                    {item.detail}
                  </p>
                </div>
                <Pill>Slot</Pill>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <SurfaceCard>
          <SectionHeader title="Upcoming" action={<Pill>Preview</Pill>} />
          <div className="grid gap-2 text-sm">
            {PREVIEW_UPCOMING.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2 first:border-t-0 first:pt-0"
              >
                <span>{item}</span>
                <Pill>Slot</Pill>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <SectionHeader
            title="Suggested actions"
            action={<Pill>Preview</Pill>}
          />
          <div className="grid gap-2 text-sm">
            {PREVIEW_ACTIONS.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2 first:border-t-0 first:pt-0"
              >
                <span>{item}</span>
                <Pill>Soon</Pill>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <section id="modules" className="grid scroll-mt-20 gap-3">
        <SectionHeader title="Modules" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <Link
              key={module.id}
              to={module.path as LinkProps['to']}
              className="grid min-h-28 gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-[var(--app-fg)] no-underline"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
                  <Icon name={module.icon} />
                </span>
                <Pill tone={module.status === 'live' ? 'success' : 'default'}>
                  {module.status === 'live' ? 'Live' : 'Soon'}
                </Pill>
              </div>
              <div>
                <h3 className="m-0 text-sm font-semibold">{module.label}</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  {module.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="xl:hidden">
        <GroupInspector compact />
      </div>
    </div>
  )
}
