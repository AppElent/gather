import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { TimelineScreen } from '../../../../../../src/modules/finances/TimelineScreen'

export default function FinanceLabTimeline() {
  const { calculationId } = useLocalSearchParams<{ calculationId: string }>()
  return (
    <TimelineScreen
      calculationId={calculationId as Id<'mortgageCalculations'>}
    />
  )
}
