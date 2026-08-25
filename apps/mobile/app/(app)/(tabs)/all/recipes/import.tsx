/** Importing a recipe from a link, mounted under all. */
import { ComposeRecipeScreen } from '../../../../../src/modules/recipes/ComposeRecipeScreen'

export default function ImportRecipe() {
  return <ComposeRecipeScreen base="/all/recipes" mode="import" />
}
