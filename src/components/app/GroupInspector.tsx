import { MODULES } from '../../lib/modules'
import {
  AvatarStack,
  Pill,
  SectionHeader,
  StatusDot,
  SurfaceCard,
} from './ShellPrimitives'

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
            <span>Review this week's meals</span>
            <Pill>Kitchen</Pill>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-2">
            <span>Check shared list updates</span>
            <Pill>Group</Pill>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title="Members"
          action={<Pill tone="success">synced</Pill>}
        />
        <AvatarStack members={['Alex', 'Maya']} />
      </SurfaceCard>
    </aside>
  )
}
