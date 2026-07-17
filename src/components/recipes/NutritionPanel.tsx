import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type NutritionFacts,
  type NutritionSource,
} from '../../../convex/lib/nutrition'

const SOURCE_LABELS: Record<NutritionSource, string> = {
  imported: 'Imported',
  ai: 'AI estimate',
  manual: 'Manual',
}

interface Props {
  nutrition: NutritionFacts
  /** Pre-formatted label shown next to "Nutrition", e.g. "per serving · 4 servings" or "per 100 g". */
  unitLabel?: string
  source?: NutritionSource
}

export function NutritionPanel({ nutrition, unitLabel, source }: Props) {
  const present = NUTRIENT_KEYS.filter((key) => nutrition[key] !== undefined)
  if (present.length === 0) return null
  return (
    <section className="mb-4 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">
          Nutrition{' '}
          {unitLabel && (
            <span className="text-xs font-normal opacity-60">{unitLabel}</span>
          )}
        </h2>
        {source && (
          <span className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-xs opacity-70">
            {SOURCE_LABELS[source]}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {present.map((key) => (
          <div key={key}>
            <dt className="opacity-60">{NUTRIENT_LABELS[key]}</dt>
            <dd className="font-medium">{nutrition[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
