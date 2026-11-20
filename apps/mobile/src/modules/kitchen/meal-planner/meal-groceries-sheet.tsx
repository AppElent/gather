/**
 * One planned meal onto the grocery list (APP-421): the meal sheet's
 * "Groceries for this recipe" opens APP-312's add-to-groceries sheet for the
 * meal's Recipe, with the stepper starting at the meal's servings.
 *
 * The Recipe is loaded by its id, not looked up in the planner's visible week:
 * the meal sheet saves a new date before this opens, so a meal just moved to
 * another week is no longer in that week (APP-435).
 */
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { RecipeToGroceriesSheet } from '../add-to-groceries/recipe-sheet'

export function MealGroceriesSheet({
  recipeId,
  servings,
  onClose,
}: {
  recipeId: string
  servings: number
  onClose: () => void
}) {
  const { group } = useGroup()
  const recipe = useQuery(api.recipes.get, {
    id: recipeId as Id<'recipes'>,
    groupSlug: group.slug,
  })
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
