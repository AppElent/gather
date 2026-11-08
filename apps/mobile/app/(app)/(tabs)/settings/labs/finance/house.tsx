import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { HouseScreen } from '../../../../../../src/modules/finances/HouseScreen'

export default function FinanceLabHouse() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return (
    <HouseScreen
      houseId={houseId as Id<'houses'>}
    />
  )
}
