/**
 * Add to groceries from a recipe (APP-312): the recipe's ingredients, read
 * locally and by the AI where needed, in the source-agnostic sheet with a
 * servings stepper that starts at the recipe's own servings.
 */
import { useState } from 'react'
import { plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { useSheetDraft } from '../../../ui/sheet-drafts'
import { AddToGroceriesSheet } from './add-sheet'
import { useRecipeLines } from './use-recipe-lines'

export function RecipeToGroceriesSheet({
  recipe,
  startServings,
  onClose,
}: {
  recipe: {
    _id: string
    title: string
    ingredients: readonly string[]
    servings?: number
  }
  /** The servings the stepper starts at, when not the recipe's own (a meal's). */
  startServings?: number
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const words = t.tasks.grocery.addLines
  const { lines, aiCount, readingAsText } = useRecipeLines({
    id: recipe._id,
    ingredients: recipe.ingredients,
    servings: recipe.servings,
  })
  // A share keeps the stepper with the sheet's ticks (APP-622).
  const place = `groceries:recipe:${recipe._id}`
  const draft = useSheetDraft<{ servings: number }>(`${place}:servings`)
  const [servings, setServings] = useState(
    draft.kept?.servings ?? startServings ?? recipe.servings ?? 0,
  )
  draft.track({ servings })

  return (
    <AddToGroceriesSheet
      place={place}
      source={{
        title: recipe.title,
        subtitle: recipe.servings
          ? plural(locale, recipe.servings, words.recipeServes)
          : words.recipe,
        glyph: UI_ICONS.BookOpen,
      }}
      lines={lines}
      // A recipe that does not say how many it serves cannot scale.
      servings={
        recipe.servings ? { value: servings, onChange: setServings } : undefined
      }
      aiCount={aiCount}
      readingAsText={readingAsText}
      onClose={onClose}
    />
  )
}
