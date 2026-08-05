import {
  NUTRIENT_KEYS,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'
import { useMessages } from '../../lib/i18n'

interface Props {
  totals: NutritionFacts
  targets?: NutritionFacts
  /** Defaults to the "today" wording; callers pass a dated one for other days. */
  heading?: string
}

export function DayTotals({ totals, targets, heading }: Props) {
  const messages = useMessages()
  const labels = messages.nutrients.labels
  const present = NUTRIENT_KEYS.filter(
    (key) => totals[key] !== undefined || targets?.[key] !== undefined,
  )
  if (present.length === 0) return null
  return (
    <section className="mb-6 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <h2 className="mb-2 font-medium">
        {heading ?? messages.nutrition.diary.totalsToday}
      </h2>
      <dl className="grid gap-2">
        {present.map((key) => {
          const value = totals[key] ?? 0
          const target = targets?.[key]
          const pct =
            target !== undefined && target > 0
              ? Math.min(100, Math.round((value / target) * 100))
              : undefined
          return (
            <div key={key}>
              <div className="flex justify-between text-sm">
                <dt className="opacity-60">{labels[key]}</dt>
                <dd className="font-medium">
                  {target !== undefined ? `${value} / ${target}` : value}
                </dd>
              </div>
              {pct !== undefined && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-accent)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
