import { useLocalSearchParams } from 'expo-router'

import { CalendarEventScreen } from '../../../../../src/modules/kitchen/CalendarEventScreen'

export default function CalendarEventRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>()
  return <CalendarEventScreen eventId={eventId} />
}
