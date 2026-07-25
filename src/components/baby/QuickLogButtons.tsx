import { Layers } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  BABY_EVENT_LABELS,
  BABY_EVENT_TYPES,
} from '../../../convex/lib/babyEvents'
import { SurfaceCard } from '../app/ShellPrimitives'
import { EventForm } from './EventForm'
import { EventIcon } from './EventIcon'
import { MultiEventForm } from './MultiEventForm'

export function QuickLogButtons({
  spaceSlug,
  babyId,
}: {
  spaceSlug: string
  babyId: Id<'babies'>
}) {
  const [active, setActive] = useState<BabyEventType | 'multi' | null>(null)

  return (
    <SurfaceCard>
      {active === null && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-sm font-semibold">Log an entry</h2>
          <button
            type="button"
            onClick={() => setActive('multi')}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--app-radius)] border border-[var(--app-border)] px-2.5 text-sm font-semibold"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            Log several
          </button>
        </div>
      )}
      {active === 'multi' ? (
        <MultiEventForm
          spaceSlug={spaceSlug}
          babyId={babyId}
          onDone={() => setActive(null)}
          onCancel={() => setActive(null)}
        />
      ) : active ? (
        <EventForm
          spaceSlug={spaceSlug}
          babyId={babyId}
          type={active}
          onDone={() => setActive(null)}
          onCancel={() => setActive(null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BABY_EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActive(type)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-semibold"
            >
              <EventIcon type={type} className="h-5 w-5" />
              {BABY_EVENT_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </SurfaceCard>
  )
}
