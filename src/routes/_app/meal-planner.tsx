import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MealPlannerError } from '../../components/meal-planner/MealPlannerError'
import { MealPlannerNotices } from '../../components/meal-planner/MealPlannerNotices'

/** What every Meal planner page shares, kept while going between them. */
export const Route = createFileRoute('/_app/meal-planner')({
  errorComponent: MealPlannerError,
  component: function MealPlannerLayout() {
    return (
      <MealPlannerNotices>
        <Outlet />
      </MealPlannerNotices>
    )
  },
})
