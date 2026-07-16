import { MODULES } from '../../lib/modules'
import { Pill, SectionHeader, StatusDot, SurfaceCard } from './ShellPrimitives'

export function GroupInspector({ compact = false }: { compact?: boolean }) {
  const liveCount = MODULES.filter((module) => module.status === 'live').length
  const plannedCount = MODULES.length - liveCount

  return (
    <aside
      aria-label="Group overview"
      className={compact ? 'grid gap-3' : 'grid gap-4'}
    >
      <SurfaceCard>
        <SectionHeader
          title="Active modules"
          action={<Pill>{liveCount} live</Pill>}
        />
        <div className="grid gap-2 text-sm">
          <StatusDot label="Recipes connected" />
          <p className="m-0 text-[var(--app-muted)]">
            {plannedCount} planned modules are ready as placeholders.
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="Today"
          action={<Pill tone="warning">Preview</Pill>}
        />
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2 first:border-t-0 first:pt-0">
            <span>Meal planning snapshot</span>
            <Pill>Slot</Pill>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2">
            <span>Shared updates snapshot</span>
            <Pill>Slot</Pill>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="Members"
          action={<Pill tone="warning">Preview data</Pill>}
        />
        <p className="m-0 text-sm leading-6 text-[var(--app-muted)]">
          Member details will appear here when group data is connected.
        </p>
      </SurfaceCard>
    </aside>
  )
}
