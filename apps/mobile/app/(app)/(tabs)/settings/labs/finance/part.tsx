import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../../convex/_generated/dataModel'

import { LoanPartScreen } from '../../../../../../src/modules/finances/LoanPartScreen'

export default function FinanceLabPart() {
  const { partId } = useLocalSearchParams<{ partId: string }>()
  return (
    <LoanPartScreen
      base="/settings/labs/finance"
      partId={partId as Id<'loanParts'>}
    />
  )
}
