import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  BABY_EVENT_LABELS,
  BABY_EVENT_TYPES,
} from '../../../convex/lib/babyEvents'
import { EVENT_TYPE_ICONS } from '../../lib/babyEventFields'
import { SurfaceCard } from '../app/ShellPrimitives'
import { EventForm } from './EventForm'

export function QuickLogButtons({ babyId }: { babyId: Id<'babies'> }) {
  const [active, setActive] = useState<BabyEventType | null>(null)

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-3 text-sm font-semibold">Log an entry</h2>
      {active ? (
        <EventForm
          babyId={babyId}
          type={active}
          onDone={() => setActive(null)}
          onCancel={() => setActive(null)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BABY_EVENT_TYPES.map((type) => {
            const Icon =
              (Icons as unknown as Record<string, LucideIcon>)[
                EVENT_TYPE_ICONS[type] ?? 'Circle'
              ] ?? Icons.Circle
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActive(type)}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-semibold"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {BABY_EVENT_LABELS[type]}
              </button>
            )
          })}
        </div>
      )}
    </SurfaceCard>
  )
}
