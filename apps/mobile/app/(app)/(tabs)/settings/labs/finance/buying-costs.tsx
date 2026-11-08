import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { BuyingCostsScreen } from '../../../../../../src/modules/finances/BuyingCostsScreen'

export default function FinanceLabBuyingCosts() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return (
    <BuyingCostsScreen
      houseId={houseId as Id<'houses'>}
    />
  )
}
