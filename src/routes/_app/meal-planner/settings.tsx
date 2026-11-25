import { createFileRoute } from '@tanstack/react-router'
import { MealPlannerError } from '../../../components/meal-planner/MealPlannerError'
import { MealPreferencesPage } from '../../../components/meal-planner/MealPreferencesPage'

export const Route = createFileRoute('/_app/meal-planner/settings')({
  errorComponent: MealPlannerError,
  component: MealPreferencesPage,
})
