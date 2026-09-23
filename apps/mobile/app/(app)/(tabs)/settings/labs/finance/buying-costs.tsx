import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { BuyingCostsScreen } from '../../../../../../src/modules/finances/BuyingCostsScreen'

export default function FinanceLabBuyingCosts() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return (
    <BuyingCostsScreen
      base="/settings/labs/finance"
      houseId={houseId as Id<'houses'>}
    />
  )
}
