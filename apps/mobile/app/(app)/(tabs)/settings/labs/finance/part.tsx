import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../src/convex/api'

import { LoanPartScreen } from '../../../../../../src/modules/finances/LoanPartScreen'

export default function FinanceLabPart() {
  const { partId } = useLocalSearchParams<{ partId: string }>()
  return (
    <LoanPartScreen
      partId={partId as Id<'loanParts'>}
    />
  )
}
