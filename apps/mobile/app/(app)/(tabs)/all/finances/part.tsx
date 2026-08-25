/**
 * LoanPart, mounted under all.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { LoanPartScreen } from '../../../../../src/modules/finances/LoanPartScreen'

export default function FinancesPart() {
  const { partId } = useLocalSearchParams<{ partId: string }>()
  return (
    <LoanPartScreen base="/all/finances" partId={partId as Id<'loanParts'>} />
  )
}
