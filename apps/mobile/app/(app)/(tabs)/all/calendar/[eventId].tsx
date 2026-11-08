import { useLocalSearchParams } from 'expo-router'

import { CalendarEventScreen } from '../../../../../src/modules/calendar/CalendarEventScreen'

export default function CalendarEventRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <CalendarEventScreen eventId={eventId} />
}
