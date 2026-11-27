import { createFileRoute } from '@tanstack/react-router'
import { validateWeekSearch } from '../../../components/meal-planner/data'
import { MealPlannerError } from '../../../components/meal-planner/MealPlannerError'
import { MealPlannerPage } from '../../../components/meal-planner/MealPlannerPage'

export const Route = createFileRoute('/_app/meal-planner/')({
  validateSearch: validateWeekSearch,
  errorComponent: MealPlannerError,
  component: function MealPlannerRoute() {
    return <MealPlannerPage search={Route.useSearch()} />
  },
})
