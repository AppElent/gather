/**
 * Timeline, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { TimelineScreen } from '../../../../../src/modules/finances/TimelineScreen'

export default function FinancesTimeline() {
  const { calculationId } = useLocalSearchParams<{ calculationId: string }>()
  return (
    <TimelineScreen
      base="/home/finances"
      calculationId={calculationId as Id<'mortgageCalculations'>}
    />
  )
}
