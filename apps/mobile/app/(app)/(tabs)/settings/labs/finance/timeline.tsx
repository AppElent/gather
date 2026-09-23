import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { TimelineScreen } from '../../../../../../src/modules/finances/TimelineScreen'

export default function FinanceLabTimeline() {
  const { calculationId } = useLocalSearchParams<{ calculationId: string }>()
  return (
    <TimelineScreen
      base="/settings/labs/finance"
      calculationId={calculationId as Id<'mortgageCalculations'>}
    />
  )
}
