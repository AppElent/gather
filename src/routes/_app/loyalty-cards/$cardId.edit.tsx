import { createFileRoute } from '@tanstack/react-router'
import { EditLoyaltyCardPage } from '../../../components/loyaltyCards/EditLoyaltyCardPage'

export const Route = createFileRoute('/_app/loyalty-cards/$cardId/edit')({
  component: () => <EditLoyaltyCardPage cardId={Route.useParams().cardId} />,
})
