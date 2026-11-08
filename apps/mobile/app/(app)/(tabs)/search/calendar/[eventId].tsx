/** An event opened from Search; Back returns to the results. */
import { useLocalSearchParams } from 'expo-router'

import { CalendarEventScreen } from '../../../../../src/modules/calendar/CalendarEventScreen'

export default function SearchEvent() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <CalendarEventScreen eventId={eventId} />
}
