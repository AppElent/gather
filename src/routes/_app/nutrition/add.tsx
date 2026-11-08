import { localIsoDate } from '@gather/core/civil-date'
import { MEAL_NAMES, type MealName } from '@gather/core/domain'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AddSheet } from '../../../components/nutrition/AddSheet'

/**
 * The meal being added to, defaulting to the first slot for a hand-typed URL,
 * and optionally the food a just-saved form handed back (#93/#79).
 */
function validateAddSearch(search: Record<string, unknown>): {
  meal: MealName
  food?: string
} {
  const meal = MEAL_NAMES.find((name) => name === search.meal)
  return {
    meal: meal ?? 'breakfast',
    food: typeof search.food === 'string' ? search.food : undefined,
  }
}

/**
 * Adding food, as a place rather than as a piece of component state.
 *
 * Because it has an address — the day comes from the parent route's search, the
 * meal from this one's — the phone's back gesture closes it, a reload does not
 * lose it, and it can be linked to. The diary underneath is the parent route
 * and never unmounts, so closing is a navigation up rather than a re-render of
 * the day.
 */
export const Route = createFileRoute('/_app/nutrition/add')({
  component: AddToMeal,
  validateSearch: validateAddSearch,
})

function AddToMeal() {
  const { date, meal, food } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <AddSheet
      date={date || localIsoDate()}
      meal={meal}
      justAddedFoodId={food}
      onClose={() =>
        navigate({
          to: '/nutrition',
          search: { date },
        })
      }
    />
  )
}
