import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../convex/_generated/dataModel'

import { RecurringCostScreen } from '../../../../../src/modules/finances/RecurringCostScreen'

export default function RecurringCost() {
  const { costId } = useLocalSearchParams<{ costId: string }>()
  return (
    <RecurringCostScreen
      base="/all/recurring-costs"
      costId={costId as Id<'recurringCosts'>}
    />
  )
}
