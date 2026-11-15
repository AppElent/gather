import { createFileRoute } from '@tanstack/react-router'
import { LoyaltyCardsPage } from '../../../components/loyaltyCards/LoyaltyCardsPage'

export const Route = createFileRoute('/_app/loyalty-cards/')({
  component: LoyaltyCardsPage,
})
