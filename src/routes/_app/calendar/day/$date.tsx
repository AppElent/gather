import { isIsoDate } from '@gather/core/civil-date'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarError } from '../../../../components/calendar/CalendarError'
import {
  CalendarDayPage,
  CalendarNoDay,
} from '../../../../components/calendar/CalendarNestedPages'

export const Route = createFileRoute('/_app/calendar/day/$date')({
  errorComponent: CalendarError,
  component: CalendarDayRoute,
})

function CalendarDayRoute() {
  const { date } = Route.useParams()
  return isIsoDate(date) ? <CalendarDayPage date={date} /> : <CalendarNoDay />
}
