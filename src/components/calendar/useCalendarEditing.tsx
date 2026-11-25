import type { CalendarEvent, CalendarPerson } from '@gather/core/calendar'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'
import { useConfirmAction } from '../app/ConfirmAction'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { CalendarsDialog } from './CalendarsDialog'
import { EventDialog } from './EventDialog'
import type { WebCalendar } from './useCalendar'

type Open =
  | { kind: 'create'; day: string }
  | { kind: 'edit'; event: CalendarEvent }
  | { kind: 'calendars' }

/** Add, edit and delete, the same from the page, the panel and own pages. */
export function useCalendarEditing({
  calendars,
  people,
  today,
  onSaved,
  onDeleted,
}: {
  calendars: readonly WebCalendar[]
  people: readonly CalendarPerson[]
  today: string
  onSaved: (saved: { id: string; date: string }, isNew: boolean) => void
  onDeleted: (event: CalendarEvent) => void
}) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const messages = useMessages()
  const words = messages.calendar
  const remove = useMutation(api.calendar.removeCalendarEvent)
  const { confirm, dialog: confirmDialog } = useConfirmAction()
  const [open, setOpen] = useState<Open | null>(null)
  const [lastUsed, setLastUsed] = useState<string | null>(null)
  const close = () => setOpen(null)

  // The calendar last added to, then by name: what a new event starts on.
  const writable = calendars
    .filter(({ readOnly }) => !readOnly)
    .sort(
      (a, b) =>
        Number(b.id === lastUsed) - Number(a.id === lastUsed) ||
        a.name.localeCompare(b.name),
    )

  return {
    isOpen: open !== null || confirmDialog !== null,
    /** With no calendar to put it in, adding one comes first. */
    create: (day: string) =>
      setOpen(
        writable.length > 0 ? { kind: 'create', day } : { kind: 'calendars' },
      ),
    edit: (event: CalendarEvent) => setOpen({ kind: 'edit', event }),
    manage: () => setOpen({ kind: 'calendars' }),
    remove: (event: CalendarEvent) =>
      confirm({
        title: fmt(words.confirmDelete, { title: event.title }),
        confirmLabel: messages.common.actions.delete,
        run: async () => {
          await remove({ groupSlug, id: event.id as Id<'calendarEvents'> })
          onDeleted(event)
        },
      }),
    dialogs: (
      <>
        {open?.kind === 'calendars' ? (
          <CalendarsDialog calendars={calendars} onClose={close} />
        ) : open ? (
          <EventDialog
            event={open.kind === 'edit' ? open.event : undefined}
            day={open.kind === 'create' ? open.day : open.event.date}
            today={today}
            calendars={writable}
            people={people}
            onClose={close}
            onSaved={(saved) => {
              close()
              setLastUsed(saved.calendarId)
              onSaved(saved, open.kind === 'create')
            }}
          />
        ) : null}
        {confirmDialog}
      </>
    ),
  }
}
