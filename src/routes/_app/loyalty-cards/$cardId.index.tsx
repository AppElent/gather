import { createFileRoute } from '@tanstack/react-router'
import { LoyaltyCardPage } from '../../../components/loyaltyCards/LoyaltyCardPage'

export const Route = createFileRoute('/_app/loyalty-cards/$cardId/')({
  component: () => <LoyaltyCardPage cardId={Route.useParams().cardId} />,
})
