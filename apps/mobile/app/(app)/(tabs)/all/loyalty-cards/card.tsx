import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../src/convex/api'
import { LoyaltyCardViewScreen } from '../../../../../src/features/loyalty-cards/card/loyalty-card-view-screen'

export default function LoyaltyCard() {
  const { cardId, justAdded } = useLocalSearchParams<{
    cardId: string
    justAdded?: string
  }>()
  return (
    <LoyaltyCardViewScreen
      cardId={cardId as Id<'loyaltyCards'>}
      justAdded={justAdded === '1'}
    />
  )
}
