import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { Pill, SurfaceCard } from './ShellPrimitives'

export function ModulePlaceholder({
  label,
  description,
  icon,
}: {
  label: string
  description: string
  icon: string
}) {
  const Icon =
    (Icons as unknown as Record<string, LucideIcon>)[icon] ?? Icons.Square

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <SurfaceCard>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-2xl font-semibold">{label}</h1>
              <Pill>Module planned</Pill>
            </div>
            <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">
              {description}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="m-0 text-sm font-semibold">What will live here</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
          This group module is staged in the command center so navigation,
          sharing, and mobile layout are ready before the full workflow is
          implemented.
        </p>
      </SurfaceCard>
    </div>
  )
}
