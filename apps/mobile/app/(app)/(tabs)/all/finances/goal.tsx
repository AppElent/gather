/**
 * SavingsGoal, mounted under all.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { SavingsGoalScreen } from '../../../../../src/modules/finances/SavingsScreen'

export default function FinancesGoal() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>()
  return (
    <SavingsGoalScreen
      base="/all/finances"
      goalId={goalId as Id<'savingsGoals'>}
    />
  )
}
