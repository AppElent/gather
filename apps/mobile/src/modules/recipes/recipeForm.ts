/**
 * The shape of a recipe while somebody is typing it, and what that turns into.
 *
 * Three conversions, all of them pure, so the form screen holds text and
 * nothing else:
 *
 * - an **import result** in, form values out — what the importer guessed,
 *   ready to be corrected;
 * - a **saved recipe** in, form values out — the edit case;
 * - **form values** in, mutation arguments out.
 *
 * ## Lines, not a list builder
 *
 * Ingredients and steps are held as one string each and split on newlines when
 * they are saved. A phone keyboard already has a return key; a list builder
 * puts an *Add another* button between the person and the next ingredient, and
 * fourteen of those is the thing the phone is worst at. Blank lines are dropped
 * on the way out, so pressing return twice costs nothing.
 *
 * ## Nutrition is carried, not typed
 *
 * The eight nutrient figures are held here exactly as they arrived — from an
 * import, or from an estimate somebody asked for — and there is no per-nutrient
 * input on the phone. Typing eight numbers into a phone is the same problem as
 * typing fourteen ingredients, and the web keeps its grid for whoever wants
 * one. What the phone offers is the *estimate*, which is one tap.
 *
 * ## A problem is a key
 *
 * `recipeFormProblem` answers with a name, and the screen resolves it against
 * the message tree. A validator that returned "A recipe needs a title." would
 * be an English sentence in a file no locale can reach (ADR-0011).
 */
import type { NutrientKey, NutritionSource } from '@gather/core/domain'

type NutritionFacts = Partial<Record<NutrientKey, number>>

/** A recipe mid-edit: text as typed, plus the two things that are not text. */
export interface RecipeFormValues {
  title: string
  description: string
  /** One ingredient per line. */
  ingredients: string
  /** One step per line. */
  steps: string
  /** Comma-separated. */
  tags: string
  /** As typed, so a half-finished number is not silently rounded. */
  servings: string
  rating: number | undefined
  nutrition: NutritionFacts | undefined
  nutritionSource: NutritionSource | undefined
}

/** The only thing that can be wrong with a recipe. */
export type RecipeFormProblem = 'titleRequired'

/** What the importer hands back, as much of it as the form takes. */
export interface ImportedRecipe {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  servings?: number
  nutrition?: NutritionFacts
  nutritionSource?: NutritionSource
}

/** A recipe as `recipes.get` returns it, as much of it as the form takes. */
export interface SavedRecipe {
  title: string
  description?: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating?: number
  servings?: number
  nutrition?: NutritionFacts
  nutritionSource?: NutritionSource
}

/** What `recipes.create` and `recipes.update` both want. */
export interface RecipeFields {
  title: string
  description: string | undefined
  ingredients: string[]
  steps: string[]
  tags: string[]
  rating: number | undefined
  servings: number | undefined
  nutrition: NutritionFacts | undefined
  nutritionSource: NutritionSource | undefined
}

export function blankRecipeForm(): RecipeFormValues {
  return {
    title: '',
    description: '',
    ingredients: '',
    steps: '',
    tags: '',
    servings: '',
    rating: undefined,
    nutrition: undefined,
    nutritionSource: undefined,
  }
}

/**
 * An import, ready to be read and corrected.
 *
 * Nothing is rated: a rating is what somebody thought of cooking it, and
 * nobody has cooked this yet.
 */
export function recipeFormFromImport(
  imported: ImportedRecipe,
): RecipeFormValues {
  return {
    title: imported.title,
    description: imported.description ?? '',
    ingredients: imported.ingredients.join('\n'),
    steps: imported.steps.join('\n'),
    tags: imported.tags.join(', '),
    servings: imported.servings !== undefined ? String(imported.servings) : '',
    rating: undefined,
    nutrition: imported.nutrition,
    nutritionSource: imported.nutritionSource,
  }
}

/** A saved recipe, opened for editing. */
export function recipeFormFromRecipe(recipe: SavedRecipe): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    ingredients: recipe.ingredients.join('\n'),
    steps: recipe.steps.join('\n'),
    tags: recipe.tags.join(', '),
    servings: recipe.servings !== undefined ? String(recipe.servings) : '',
    rating: recipe.rating,
    nutrition: recipe.nutrition,
    nutritionSource: recipe.nutritionSource,
  }
}

/**
 * What is stopping this from being saved, if anything.
 *
 * A title and no more. A recipe with no ingredients is one somebody is part
 * way through writing down, and refusing to save it would lose the part they
 * have — the same reason the web only marks the title `required`.
 */
export function recipeFormProblem(
  values: RecipeFormValues,
): RecipeFormProblem | null {
  if (!values.title.trim()) return 'titleRequired'
  return null
}

/**
 * The arguments a save sends.
 *
 * Every empty answer is `undefined` rather than an empty string or a zero, so
 * that clearing a field on the phone and never filling it in on the web reach
 * the schema the same way.
 */
export function recipeFieldsFrom(values: RecipeFormValues): RecipeFields {
  const nutrition = hasFacts(values.nutrition) ? values.nutrition : undefined
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    ingredients: lines(values.ingredients),
    steps: lines(values.steps),
    tags: commaSeparated(values.tags),
    rating: values.rating,
    servings: positiveInt(values.servings),
    nutrition,
    // A source with no figures under it says where nothing came from.
    nutritionSource: nutrition
      ? (values.nutritionSource ?? 'manual')
      : undefined,
  }
}

/** Non-blank lines, trimmed. */
function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Non-blank comma-separated parts, trimmed. */
function commaSeparated(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * A serving count, or nothing.
 *
 * Zero servings, half a serving and "four" are all the same answer: this
 * recipe does not say. Rounded rather than refused, because a phone's numeric
 * keypad still offers a decimal point.
 */
function positiveInt(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(value) || value < 1) return undefined
  return Math.round(value)
}

function hasFacts(facts: NutritionFacts | undefined): facts is NutritionFacts {
  return (
    facts !== undefined && Object.values(facts).some((v) => v !== undefined)
  )
}
