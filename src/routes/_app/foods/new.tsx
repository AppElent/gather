import { createFileRoute } from '@tanstack/react-router'
import { useRequiredCurrentGroup } from '#/components/app/useCurrentGroup'
import {
  MEAL_NAMES,
  type MealName,
} from '../../../../convex/lib/consumption'
import { groupFoodNav } from '../../../components/foods/foodNav'
import {
  NewFoodPage,
  validateNewFoodSearch,
} from '../../../components/foods/NewFoodPage'
import { groupNutritionNav } from '../../../components/nutrition/nutritionNav'

export const Route = createFileRoute('/_app/foods/new')({
  component: GroupNewFood,
  validateSearch: validateNewFoodSearch,
})

function GroupNewFood() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { barcode, name, returnDate, returnMeal } = Route.useSearch()

  // The one place that knows both Modules' addresses. A day and a meal in the
  // search mean somebody came from the add sheet — reviewing an Open Food Facts
  // import (#93) or adding a food a search found nothing for (#79) — and saving
  // hands them back to that meal with the new food ready to log, rather than
  // leaving them in the Catalog holding a food they came here to eat.
  const meal: MealName | undefined = MEAL_NAMES.find((m) => m === returnMeal)
  const nutrition = groupNutritionNav(groupSlug)
  const after =
    returnDate && meal
      ? (foodId: string) => nutrition.addEntry(returnDate, meal, foodId)
      : undefined

  return (
    <NewFoodPage
      barcode={barcode}
      name={name}
      after={after}
      nav={groupFoodNav(groupSlug)}
    />
  )
}
