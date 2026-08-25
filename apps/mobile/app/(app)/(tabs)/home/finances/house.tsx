/**
 * House, mounted under home.
 *
 * Thin on purpose: a Module lives inside each tab stack (ADR-0023), so every
 * screen here exists at two addresses and the component behind them exists
 * once. The `base` is the only thing that differs.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../../../convex/_generated/dataModel'
import { HouseScreen } from '../../../../../src/modules/finances/HouseScreen'

export default function FinancesHouse() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>()
  return <HouseScreen base="/home/finances" houseId={houseId as Id<'houses'>} />
}
