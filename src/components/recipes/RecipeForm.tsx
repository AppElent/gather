import { useState } from 'react'
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutrientKey,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'
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

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]'

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

// Accepts Dutch decimal commas ("12,5"); empty/invalid/negative → undefined.
const parseDecimal = (s: string): number | undefined => {
  if (!s.trim()) return undefined
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const parsePositiveInt = (s: string): number | undefined => {
  const n = parseDecimal(s)
  return n && n >= 1 ? Math.round(n) : undefined
}
const toInputs = (facts?: NutritionFacts): Record<NutrientKey, string> =>
  Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [
      k,
      facts?.[k] !== undefined ? String(facts[k]) : '',
    ]),
  ) as Record<NutrientKey, string>

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
    toInputs(initial?.nutrition),
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
        const facts: NutritionFacts = {}
        for (const key of NUTRIENT_KEYS) {
          const value = parseDecimal(nutritionInputs[key])
          if (value !== undefined) facts[key] = value
        }
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
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUTRIENT_KEYS.map((key) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium">
                {NUTRIENT_LABELS[key]}
              </span>
              <input
                inputMode="decimal"
                className={inputClass}
                value={nutritionInputs[key]}
                onChange={(e) => {
                  setNutritionInputs((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                  setNutritionSource('manual')
                }}
              />
            </label>
          ))}
        </div>
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
                  setNutritionInputs(toInputs(facts))
                  setNutritionSource('ai')
                } catch (err) {
                  setEstimateError(
                    err instanceof Error
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
        disabled={submitting}
        className="w-fit rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save recipe'}
      </button>
    </form>
  )
}
