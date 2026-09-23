import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { MortgageScreen } from '../../../../../../src/modules/finances/MortgageScreen'

export default function FinanceLabMortgage() {
  const { calculationId } = useLocalSearchParams<{ calculationId: string }>()
  return (
    <MortgageScreen
      base="/settings/labs/finance"
      calculationId={calculationId as Id<'mortgageCalculations'>}
    />
  )
}
