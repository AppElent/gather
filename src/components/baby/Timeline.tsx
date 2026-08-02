import { useMutation } from 'convex/react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { BABY_EVENT_LABELS } from '../../../convex/lib/babyEvents'
import {
  dayKey,
  formatEventDateHeading,
  formatEventTimestamp,
} from '../../lib/babyDate'
import { summarizeEvent } from '../../lib/babyEventSummary'
import { useConfirmAction } from '../app/ConfirmAction'
import { SurfaceCard } from '../app/ShellPrimitives'
import { EventForm } from './EventForm'
import { EventIcon } from './EventIcon'

interface TimelineProps {
  babyId: Id<'babies'>
  /** The Group the log is being read in — editing and deleting go through it. */
  groupSlug: string
  events: Doc<'babyEvents'>[]
}

export function Timeline({ babyId, groupSlug, events }: TimelineProps) {
  const remove = useMutation(api.babyEvents.remove)
  const { confirm, dialog } = useConfirmAction()
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
                      groupSlug={groupSlug}
                      type={event.type}
                      event={event}
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li key={event._id} className="flex items-stretch gap-1">
                    <button
                      type="button"
                      className="flex flex-1 items-start gap-3 p-3 text-left text-sm"
                      onClick={() => setEditingId(event._id)}
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
                      <ChevronRight
                        className="mt-1 h-4 w-4 shrink-0 text-[var(--app-muted)]"
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${BABY_EVENT_LABELS[event.type]} entry`}
                      className="grid min-h-9 min-w-9 shrink-0 place-items-center self-center rounded-[var(--app-radius)] text-red-800"
                      onClick={() =>
                        confirm({
                          title: 'Delete this entry?',
                          body: `${BABY_EVENT_LABELS[event.type]} — ${formatEventTimestamp(event.timestamp)}`,
                          confirmLabel: 'Delete entry',
                          errorFallback: 'Could not delete that entry.',
                          run: () => remove({ eventId: event._id, groupSlug }),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ),
              )}
            </ul>
          </SurfaceCard>
        </div>
      ))}

      {dialog}
    </div>
  )
}
