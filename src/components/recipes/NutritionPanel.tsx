import {
  NUTRIENT_KEYS,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'
import { useMessages } from '../../lib/i18n'

interface Props {
  nutrition: NutritionFacts
  /** Pre-formatted label shown next to "Nutrition", e.g. "per serving · 4 servings" or "per 100 g". */
  unitLabel?: string
  source?: NutritionSource
}

export function NutritionPanel({ nutrition, unitLabel, source }: Props) {
  const messages = useMessages()
  const nutrients = messages.nutrients
  const present = NUTRIENT_KEYS.filter((key) => nutrition[key] !== undefined)
  if (present.length === 0) return null
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">
          {messages.recipes.detail.nutrition}{' '}
          {unitLabel && (
            <span className="text-xs font-normal opacity-60">{unitLabel}</span>
          )}
        </h2>
        {source && (
          <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-xs opacity-70">
            {nutrients.sources[source]}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {present.map((key) => (
          <div key={key}>
            <dt className="opacity-60">{nutrients.labels[key]}</dt>
            <dd className="font-medium">{nutrition[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
