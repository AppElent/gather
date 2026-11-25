import { createFileRoute } from '@tanstack/react-router'
import { validateRecordSearch } from '../../../../components/meal-planner/data'
import { MealPlannerError } from '../../../../components/meal-planner/MealPlannerError'
import { RecordPage } from '../../../../components/meal-planner/RecordPage'

export const Route = createFileRoute('/_app/meal-planner/proposal/$draftId')({
  validateSearch: validateRecordSearch,
  errorComponent: MealPlannerError,
  component: function ProposalRoute() {
    const { draftId } = Route.useParams()
    const { week } = Route.useSearch()
    return <RecordPage kind="draft" id={draftId} week={week} />
  },
})
