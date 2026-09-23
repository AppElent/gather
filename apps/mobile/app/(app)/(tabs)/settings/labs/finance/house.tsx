import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { HouseScreen } from '../../../../../../src/modules/finances/HouseScreen'

export default function FinanceLabHouse() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return (
    <HouseScreen
      base="/settings/labs/finance"
      houseId={houseId as Id<'houses'>}
    />
  )
}
