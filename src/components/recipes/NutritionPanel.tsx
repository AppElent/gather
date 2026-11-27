import { NUTRIENT_KEYS, type NutritionFacts, type NutritionSource } from '@gather/core/domain'
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
    <section className="rounded-[var(--radius-card)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="m-0 text-subhead font-semibold">
          {messages.recipes.detail.nutrition}{' '}
          {unitLabel && (
            <span className="text-footnote font-normal text-[var(--muted)]">{unitLabel}</span>
          )}
        </h2>
        {source && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-2.5 py-0.5 text-footnote text-[var(--muted)]">
            {nutrients.sources[source]}
          </span>
        )}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-subhead sm:grid-cols-4">
        {present.map((key) => (
          <div key={key}>
            <dt className="text-footnote text-[var(--muted)]">{nutrients.labels[key]}</dt>
            <dd className="m-0 font-semibold tabular-nums">{nutrition[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
