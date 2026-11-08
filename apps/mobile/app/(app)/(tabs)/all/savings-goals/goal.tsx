import { useLocalSearchParams } from 'expo-router'
import type { Id } from '../../../../../src/convex/api'

import { SavingsGoalScreen } from '../../../../../src/modules/finances/SavingsScreen'

export default function SavingsGoal() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>()
  return (
    <SavingsGoalScreen
      goalId={goalId as Id<'savingsGoals'>}
    />
  )
}
