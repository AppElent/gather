import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../../../convex/_generated/dataModel'

import { SavingsGoalScreen } from '../../../../../src/modules/finances/SavingsScreen'

export default function SavingsGoal() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>()
  return (
    <SavingsGoalScreen
      base="/home/savings-goals"
      goalId={goalId as Id<'savingsGoals'>}
    />
  )
}
