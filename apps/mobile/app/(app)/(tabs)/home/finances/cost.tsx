/**
 * RecurringCost, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { RecurringCostScreen } from '../../../../../src/modules/finances/RecurringCostScreen'

export default function FinancesCost() {
  const { costId } = useLocalSearchParams<{ costId: string }>()
  return (
    <RecurringCostScreen
      base="/home/finances"
      costId={costId as Id<'recurringCosts'>}
    />
  )
}
