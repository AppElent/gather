import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { HoldingScreen } from '../../../../../../src/modules/finances/HoldingScreen'

export default function FinanceLabHolding() {
  const { holdingId } = useLocalSearchParams<{ holdingId: string }>()
  return (
    <HoldingScreen
      holdingId={holdingId as Id<'holdings'>}
    />
  )
}
