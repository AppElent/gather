/**
 * Holding, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { HoldingScreen } from '../../../../../src/modules/finances/HoldingScreen'

export default function FinancesHolding() {
  const { holdingId } = useLocalSearchParams<{ holdingId: string }>()
  return (
    <HoldingScreen
      base="/home/finances"
      holdingId={holdingId as Id<'holdings'>}
    />
  )
}
