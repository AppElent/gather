/**
 * BuyingCosts, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { BuyingCostsScreen } from '../../../../../src/modules/finances/BuyingCostsScreen'

export default function FinancesBuyingCosts() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return (
    <BuyingCostsScreen
      base="/home/finances"
      houseId={houseId as Id<'houses'>}
    />
  )
}
