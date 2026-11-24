import { useLocalSearchParams } from 'expo-router'

import { CalendarEventScreen } from '../../../../../src/modules/calendar/CalendarEventScreen'

export default function CalendarEventRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  // Keyed, so no text being typed in one record can reach another (APP-774).
  return <CalendarEventScreen key={eventId} eventId={eventId} />
}
