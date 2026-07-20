import { ConvexError } from 'convex/values'
import { useState } from 'react'
import type {
  NutritionFacts,
  NutritionSource,
} from '../../../convex/lib/nutrition'
import { NutrientInputGrid } from '../nutrition/NutrientInputGrid'
import {
  inputClass,
  nutrientInputsToFacts,
  parseDecimal,
  toNutrientInputs,
} from '../nutrition/nutrientInputs'
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
  const [nutritionInputs, setNutritionInputs] = useState(() =>
    toNutrientInputs(initial?.nutrition),
  )
  const [nutritionSource, setNutritionSource] = useState<
    NutritionSource | undefined
  >(initial?.nutritionSource)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  return (
    <form
      className="mx-auto grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const facts = nutrientInputsToFacts(nutritionInputs)
        const hasNutrition = Object.keys(facts).length > 0
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          ingredients: lines(ingredients),
          steps: lines(steps),
          tags: csv(tags),
          rating,
          servings: parsePositiveInt(servings),
          nutrition: hasNutrition ? facts : undefined,
          nutritionSource: hasNutrition
            ? (nutritionSource ?? 'manual')
            : undefined,
        })
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Ingredients</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="One per line"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Steps</span>
        <textarea
          className={`h-32 ${inputClass}`}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder="One per line"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Tags</span>
        <input
          className={inputClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated"
        />
      </label>

      <fieldset className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
        <legend className="px-1 text-sm font-medium">
          Nutrition (per serving)
        </legend>
        <label className="mb-3 block max-w-32 text-sm">
          <span className="mb-1 block font-medium">Servings</span>
          <input
            inputMode="numeric"
            className={inputClass}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="4"
            disabled={estimating}
          />
        </label>
        <NutrientInputGrid
          values={nutritionInputs}
          disabled={estimating}
          onChange={(key, value) => {
            setNutritionInputs((prev) => ({ ...prev, [key]: value }))
            setNutritionSource('manual')
          }}
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
                  setNutritionInputs(toNutrientInputs(facts))
                  setNutritionSource('ai')
                } catch (err) {
                  setEstimateError(
                    err instanceof ConvexError
                      ? typeof err.data === 'string'
                        ? err.data
                        : 'Could not estimate nutrition'
                      : err instanceof Error
                        ? err.message
                        : 'Could not estimate nutrition',
                  )
                } finally {
                  setEstimating(false)
                }
              }}
            >
              {estimating ? 'Estimating…' : 'Estimate with AI'}
            </button>
            {estimateError && (
              <p className="mt-2 text-sm text-red-800">{estimateError}</p>
            )}
          </div>
        )}
      </fieldset>

      <div className="block text-sm">
        <span className="mb-1 block font-medium">Rating</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <button
        type="submit"
        disabled={submitting || estimating}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
