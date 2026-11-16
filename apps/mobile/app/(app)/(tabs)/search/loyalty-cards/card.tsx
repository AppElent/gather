/**
 * A loyalty card opened from Search, pushed onto Search's own stack so Back
 * returns to the results. Editing it still lives under All.
 */
import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../src/convex/api'
import { LoyaltyCardViewScreen } from '../../../../../src/features/loyalty-cards/card/loyalty-card-view-screen'

export default function SearchLoyaltyCard() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>()
  return <LoyaltyCardViewScreen cardId={cardId as Id<'loyaltyCards'>} />
}
