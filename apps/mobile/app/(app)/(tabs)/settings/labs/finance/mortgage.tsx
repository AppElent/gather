import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { MortgageScreen } from '../../../../../../src/modules/finances/MortgageScreen'

export default function FinanceLabMortgage() {
  const { calculationId } = useLocalSearchParams<{ calculationId: string }>()
  return (
    <MortgageScreen
      calculationId={calculationId as Id<'mortgageCalculations'>}
    />
  )
}
