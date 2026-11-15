import { createFileRoute } from '@tanstack/react-router'
import { NewLoyaltyCardPage } from '../../../components/loyaltyCards/NewLoyaltyCardPage'

export const Route = createFileRoute('/_app/loyalty-cards/new')({
  component: NewLoyaltyCardPage,
})
