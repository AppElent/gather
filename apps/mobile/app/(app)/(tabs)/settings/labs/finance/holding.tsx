import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { HoldingScreen } from '../../../../../../src/modules/finances/HoldingScreen'

export default function FinanceLabHolding() {
  const { holdingId } = useLocalSearchParams<{ holdingId: string }>()
  return (
    <HoldingScreen
      base="/settings/labs/finance"
      holdingId={holdingId as Id<'holdings'>}
    />
  )
}
