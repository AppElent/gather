import { AI_LIMIT_KIND } from '@gather/core/ai-limit'
import { parseDecimal } from '@gather/core/decimal'
import type { NutritionFacts, NutritionSource } from '@gather/core/domain'
import { useState } from 'react'
import { errorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { inputClass } from '../kitchen/fields'
import { NutrientInputGrid } from '../kitchen/NutrientInputGrid'
import { useNutritionInputs } from '../kitchen/useNutritionInputs'
import { RecipeDestinationNotice } from './RecipeDestinationNotice'
import type { RecipeDestination } from './recipeDestination'
import { StarRating } from './StarRating'

export interface RecipeFormValues {
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

interface Props {
  initial?: RecipeFormValues
  submitting: boolean
  /**
   * The Group a save will put this recipe in, shown next to the button that
   * does it. Absent when editing, which moves nothing.
   */
  destination?: RecipeDestination
  onSubmit: (values: RecipeFormValues) => void
  onEstimate?: (args: {
    ingredients: string[]
    servings?: number
  }) => Promise<NutritionFacts>
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const csv = (s: string) =>
  s
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

const parsePositiveInt = (s: string): number | undefined => {
  const n = parseDecimal(s)
  return n && n >= 1 ? Math.round(n) : undefined
}

export function RecipeForm({
  initial,
  submitting,
  destination,
  onSubmit,
  onEstimate,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState(
    (initial?.ingredients ?? []).join('\n'),
  )
  const [steps, setSteps] = useState((initial?.steps ?? []).join('\n'))
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [rating, setRating] = useState<number | undefined>(initial?.rating)
  const [servings, setServings] = useState(
    initial?.servings !== undefined ? String(initial.servings) : '',
  )
  const nutrition = useNutritionInputs(
    initial?.nutrition,
    initial?.nutritionSource,
  )
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const messages = useMessages()
  const { form, rating: ratingText } = messages.recipes

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          ingredients: lines(ingredients),
          steps: lines(steps),
          tags: csv(tags),
          rating,
          servings: parsePositiveInt(servings),
          nutrition: nutrition.hasFigures ? nutrition.facts : undefined,
          nutritionSource: nutrition.savedSource,
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.title}</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.description}</span>
        <textarea
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.ingredients}</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={form.onePerLine}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.steps}</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={form.onePerLine}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{form.tags}</span>
        <input
          className={inputClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={form.commaSeparated}
        />
      </label>

      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          {form.nutritionLegend}
        </legend>
        <label className="mb-3 block max-w-32 text-sm">
          <span className="mb-1 block font-medium">{form.servings}</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder={form.servingsPlaceholder}
            disabled={estimating}
          />
        </label>
        <NutrientInputGrid
          values={nutrition.inputs}
          disabled={estimating}
          onChange={nutrition.type}
        />
        {onEstimate && (
          <div className="mt-3">
            <button
              type="button"
              disabled={estimating || lines(ingredients).length === 0}
              className="rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                setEstimating(true)
                setEstimateError(null)
                try {
                  const facts = await onEstimate({
                    ingredients: lines(ingredients),
                    servings: parsePositiveInt(servings),
                  })
                  nutrition.fill(facts, 'ai')
                } catch (err) {
                  setEstimateError(
                    errorMessage(err, form.estimateFailed, {
                      [AI_LIMIT_KIND]: form.aiLimitReached,
                    }),
                  )
                } finally {
                  setEstimating(false)
                }
              }}
            >
              {estimating ? form.estimating : form.estimate}
            </button>
            {estimateError && (
              <p className="mt-2 text-sm text-red-800">{estimateError}</p>
            )}
          </div>
        )}
      </fieldset>

      <div className="block text-sm">
        <span className="mb-1 block font-medium">{ratingText.label}</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <div className="grid gap-2">
        {destination && <RecipeDestinationNotice destination={destination} />}
        <button
          type="submit"
          disabled={submitting || estimating}
          className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? messages.common.actions.saving : form.save}
        </button>
      </div>
    </form>
  )
}
