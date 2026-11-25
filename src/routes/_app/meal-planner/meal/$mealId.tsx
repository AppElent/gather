import { createFileRoute } from '@tanstack/react-router'
import { validateRecordSearch } from '../../../../components/meal-planner/data'
import { MealPlannerError } from '../../../../components/meal-planner/MealPlannerError'
import { RecordPage } from '../../../../components/meal-planner/RecordPage'

export const Route = createFileRoute('/_app/meal-planner/meal/$mealId')({
  validateSearch: validateRecordSearch,
  errorComponent: MealPlannerError,
  component: function PlannedMealRoute() {
    const { mealId } = Route.useParams()
    const { week } = Route.useSearch()
    return <RecordPage kind="meal" id={mealId} week={week} />
  },
})
