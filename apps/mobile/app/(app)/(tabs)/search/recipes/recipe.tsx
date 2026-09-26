/**
 * A recipe opened from Search, pushed onto Search's own stack so Back returns
 * to the results. Deeper steps (edit) still live under All.
 */
import { RecipeScreen } from '../../../../../src/modules/recipes/RecipeScreen'

export default function SearchRecipe() {
  return <RecipeScreen base="/all/recipes" />
}
