import { createFileRoute } from '@tanstack/react-router'
import {
  LoyaltyCardPage,
  validateLoyaltyCardSearch,
} from '../../../components/loyaltyCards/LoyaltyCardPage'

export const Route = createFileRoute('/_app/loyalty-cards/$cardId/')({
  validateSearch: validateLoyaltyCardSearch,
  component: () => (
    <LoyaltyCardPage
      cardId={Route.useParams().cardId}
      justSaved={Route.useSearch().saved === true}
    />
  ),
})
