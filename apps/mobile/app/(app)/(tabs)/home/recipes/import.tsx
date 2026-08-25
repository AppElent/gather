/** Importing a recipe from a link, mounted under home. */
import { ComposeRecipeScreen } from '../../../../../src/modules/recipes/ComposeRecipeScreen'

export default function ImportRecipe() {
  return <ComposeRecipeScreen base="/home/recipes" mode="import" />
}
