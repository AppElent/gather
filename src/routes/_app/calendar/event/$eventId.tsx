import { createFileRoute } from '@tanstack/react-router'
import { CalendarError } from '../../../../components/calendar/CalendarError'
import { CalendarEventPage } from '../../../../components/calendar/CalendarNestedPages'

export const Route = createFileRoute('/_app/calendar/event/$eventId')({
  errorComponent: CalendarError,
  component: CalendarEventRoute,
})

function CalendarEventRoute() {
  const { eventId } = Route.useParams()
  return <CalendarEventPage eventId={eventId} />
}
