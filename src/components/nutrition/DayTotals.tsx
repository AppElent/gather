import { Link } from '@tanstack/react-router'
import {
  NUTRIENT_KEYS,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'
import { fmt, useMessages } from '../../lib/i18n'
import { NUTRITION_TARGETS_ANCHOR } from '../settings/NutritionTargetsSettings'

interface Props {
  totals: NutritionFacts
  targets?: NutritionFacts
  /** Defaults to the "today" wording; callers pass a dated one for other days. */
  heading?: string
}

/**
 * How much is left of a target, rounded the way the figures beside it are.
 *
 * A target of zero is not a target — it is somebody who cleared the field —
 * so it produces no remainder and no progress bar rather than a division by
 * zero. Returns the number and which of the two sentences it belongs in;
 * choosing the sentence is the renderer's job (ADR-0011).
 */
export function remainder(
  value: number,
  target: number,
): { amount: number; over: boolean } | undefined {
  if (!(target > 0)) return undefined
  const left = Math.round((target - value) * 100) / 100
  return left >= 0
    ? { amount: left, over: false }
    : { amount: -left, over: true }
}

export function DayTotals({ totals, targets, heading }: Props) {
  const messages = useMessages()
  const labels = messages.nutrients.labels
  const { targets: targetsText } = messages.nutrition.diary
  const present = NUTRIENT_KEYS.filter(
    (key) => totals[key] !== undefined || targets?.[key] !== undefined,
  )
  if (present.length === 0) return null
  return (
    <section className="mb-6 rounded-[var(--app-radius)] border border-[var(--app-border)] p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-medium">
          {heading ?? messages.nutrition.diary.totalsToday}
        </h2>
        {/* The way through to editing. Targets are Personal, so they are edited
            on /settings and not in whichever Group the diary was opened from. */}
        <Link
          to="/settings"
          hash={NUTRITION_TARGETS_ANCHOR}
          className="text-xs underline opacity-60"
        >
          {targetsText.edit}
        </Link>
      </div>
      <dl className="grid gap-2">
        {present.map((key) => {
          // One figure, shown and reckoned with. Calories arrive already
          // whole (`sumKcal`), so there is no rounded-for-display value here
          // to disagree with the target beside it — 1999.6 can no longer read
          // "2000 / 2000 · 0.4 left".
          const value = totals[key] ?? 0
          const target = targets?.[key]
          const left =
            target !== undefined ? remainder(value, target) : undefined
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
              {left && (
                <p className="mt-1 text-xs opacity-60">
                  {fmt(left.over ? targetsText.over : targetsText.remaining, {
                    amount: left.amount,
                  })}
                </p>
              )}
            </div>
          )
        })}
      </dl>
    </section>
  )
}
