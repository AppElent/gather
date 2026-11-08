import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../src/convex/api'

import { RecurringCostScreen } from '../../../../../src/modules/finances/RecurringCostScreen'

export default function RecurringCost() {
  const { costId } = useLocalSearchParams<{ costId: string }>()
  return (
    <RecurringCostScreen
      costId={costId as Id<'recurringCosts'>}
    />
  )
}
