import { useLocalSearchParams } from 'expo-router'

import type { Id } from '../../../../../src/convex/api'
import { LoyaltyCardEditScreen } from '../../../../../src/features/loyalty-cards/card/loyalty-card-edit-screen'

export default function EditLoyaltyCard() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>()
  return <LoyaltyCardEditScreen cardId={cardId as Id<'loyaltyCards'>} />
}
