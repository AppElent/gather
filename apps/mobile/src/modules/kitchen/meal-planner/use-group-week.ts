import { mondayStart, todayIn } from '@gather/core/civil-date'
import { useState } from 'react'

import { useGroup } from '../../../group/GroupProvider'

/**
 * The Monday of the week on screen, opening on the Group's own week. When the
 * Group's zone changes, a screen on the week it opens on goes to the new one;
 * a week paged to stays.
 */
export function useGroupWeek() {
  const { group } = useGroup()
  const [weekStart, setWeekStart] = useState(() =>
    mondayStart(todayIn(group.timeZone)),
  )
  const [zone, setZone] = useState(group.timeZone)
  if (zone !== group.timeZone) {
    setZone(group.timeZone)
    if (weekStart === mondayStart(todayIn(zone))) {
      setWeekStart(mondayStart(todayIn(group.timeZone)))
    }
  }
  return [weekStart, setWeekStart] as const
}
