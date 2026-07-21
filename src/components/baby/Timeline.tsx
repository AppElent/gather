import { useMutation } from 'convex/react'
import type { LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { BABY_EVENT_LABELS } from '../../../convex/lib/babyEvents'
import {
  dayKey,
  formatEventDateHeading,
  formatEventTimestamp,
} from '../../lib/babyDate'
import { EVENT_TYPE_ICONS } from '../../lib/babyEventFields'
import { summarizeEvent } from '../../lib/babyEventSummary'
import { SurfaceCard } from '../app/ShellPrimitives'
import { EventForm } from './EventForm'

interface TimelineProps {
  babyId: Id<'babies'>
  events: Doc<'babyEvents'>[]
}

function EventIcon({ type }: { type: string }) {
  const Icon =
    (Icons as unknown as Record<string, LucideIcon>)[
      EVENT_TYPE_ICONS[type] ?? 'Circle'
    ] ?? Icons.Circle
  return <Icon className="h-4 w-4" aria-hidden="true" />
}

export function Timeline({ babyId, events }: TimelineProps) {
  const remove = useMutation(api.babyEvents.remove)
  const [editingId, setEditingId] = useState<Id<'babyEvents'> | null>(null)

  if (events.length === 0) {
    return (
      <SurfaceCard>
        <p className="m-0 text-sm text-[var(--app-muted)]">
          No entries yet — log the first one above.
        </p>
      </SurfaceCard>
    )
  }

  const groups = new Map<string, Doc<'babyEvents'>[]>()
  for (const event of events) {
    const key = dayKey(event.timestamp)
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }

  return (
    <div className="grid gap-4">
      {Array.from(groups.entries()).map(([key, dayEvents]) => (
        <div key={key}>
          <p className="m-0 mb-2 text-xs font-semibold uppercase text-[var(--app-muted)]">
            {formatEventDateHeading(dayEvents[0].timestamp)}
          </p>
          <SurfaceCard>
            <ul className="m-0 list-none divide-y divide-[var(--app-border)] p-0">
              {dayEvents.map((event) =>
                editingId === event._id ? (
                  <li key={event._id} className="p-3">
                    <EventForm
                      babyId={babyId}
                      type={event.type}
                      event={event}
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={event._id}
                    className="flex items-start gap-3 p-3 text-sm"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]">
                      <EventIcon type={event.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold">
                          {BABY_EVENT_LABELS[event.type]}
                        </span>
                        <span className="text-xs text-[var(--app-muted)]">
                          {formatEventTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <p className="m-0 mt-0.5">{summarizeEvent(event)}</p>
                      {event.notes && (
                        <p className="m-0 mt-0.5 text-[var(--app-muted)]">
                          {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => setEditingId(event._id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-800 underline"
                        onClick={() => {
                          if (window.confirm('Delete this entry?')) {
                            void remove({ eventId: event._id })
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </SurfaceCard>
        </div>
      ))}
    </div>
  )
}
