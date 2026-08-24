/** Writing a recipe out by hand, mounted under home. */
import { ComposeRecipeScreen } from '../../../../../src/modules/recipes/ComposeRecipeScreen'

export default function NewRecipe() {
  return <ComposeRecipeScreen base="/home/recipes" mode="new" />
}
