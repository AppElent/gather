import { createFileRoute } from '@tanstack/react-router'
import { CalendarError } from '../../../components/calendar/CalendarError'
import { CalendarPage } from '../../../components/calendar/CalendarPage'
import {
  type CalendarSelection,
  readSelection,
} from '../../../components/calendar/calendarView'
import { validateNewSearch } from '../../../lib/createActions'

export const Route = createFileRoute('/_app/calendar/')({
  errorComponent: CalendarError,
  component: CalendarRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): CalendarSelection & { new?: true } => ({
    ...readSelection(search),
    ...validateNewSearch(search),
  }),
})

function CalendarRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CalendarPage
      day={search.day}
      event={search.event}
      startCreating={search.new}
      onCreateStarted={() =>
        void navigate({ search: readSelection({ ...search }), replace: true })
      }
    />
  )
}
