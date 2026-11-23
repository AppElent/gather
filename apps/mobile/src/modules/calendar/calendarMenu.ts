/**
 * The Calendar header's ⋯ menu: Add event on its own, then the views, then
 * Calendars and People. Kept apart from `CalendarHeader` so it can be tested
 * without the header's gestures and animation.
 */
import type { MenuAction } from '@expo/ui/community/menu'
import type { CalendarView } from '@gather/core/calendar'

import type { Messages } from '../../i18n'

export interface CalendarMenuHandlers {
  onAddEvent: () => void
  onView: (view: CalendarView) => void
  onOpenCalendars: () => void
  onOpenPeople: () => void
}

export function calendarMenuActions(
  t: Pick<Messages, 'calendar' | 'composer'>,
  presentation: CalendarView,
): MenuAction[] {
  const view = (id: CalendarView, title: string): MenuAction => ({
    id,
    title,
    state: presentation === id ? 'on' : 'off',
  })
  return [
    // An untitled inline section: a separator, with no header, sets Add event
    // apart from the views.
    {
      id: 'add',
      title: '',
      displayInline: true,
      subactions: [{ id: 'add-event', title: t.composer.addEvent, image: 'plus' }],
    },
    view('month', t.calendar.month),
    view('week', t.calendar.weekAgenda),
    view('agenda', t.calendar.agenda),
    { id: 'calendars', title: t.calendar.calendars },
    { id: 'people', title: t.calendar.people },
  ]
}

export function pressCalendarMenu(id: string, handlers: CalendarMenuHandlers) {
  if (id === 'add-event') handlers.onAddEvent()
  else if (id === 'calendars') handlers.onOpenCalendars()
  else if (id === 'people') handlers.onOpenPeople()
  else handlers.onView(id as CalendarView)
}
