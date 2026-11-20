/**
 * One planned meal onto the grocery list (APP-421): the meal sheet's
 * "Groceries for this recipe" opens APP-312's add-to-groceries sheet for the
 * meal's Recipe, with the stepper starting at the meal's servings.
 */
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { RecipeToGroceriesSheet } from '../add-to-groceries/recipe-sheet'
import { weekDays } from './week-groceries'

export function MealGroceriesSheet({
  recipeId,
  weekStart,
  servings,
  onClose,
}: {
  recipeId: string
  weekStart: string
  servings: number
  onClose: () => void
}) {
  const { group } = useGroup()
  const days = weekDays(weekStart)
  const recipes = useQuery(api.mealPlan.weekIngredients, {
    groupSlug: group.slug,
    from: days[0],
    to: days[6],
  })
  const recipe = recipes?.find((candidate) => candidate._id === recipeId)
  // Loading, or the Recipe was taken away meanwhile: nothing to add yet.
  if (!recipe) return null
  return (
    <RecipeToGroceriesSheet
      recipe={recipe}
      startServings={servings}
      onClose={onClose}
    />
  )
}
