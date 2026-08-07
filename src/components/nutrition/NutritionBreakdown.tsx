import {
  NUTRIENT_KEYS,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'
import { useMessages } from '../../lib/i18n'

/**
 * What an expanded card will actually log, for the amount currently chosen.
 *
 * Only the nutrients the source has: absence is not zero, which is the same
 * rule the diary's totals follow.
 */
export function NutritionBreakdown({ facts }: { facts: NutritionFacts }) {
  const labels = useMessages().nutrients.labels
  const present = NUTRIENT_KEYS.filter((key) => facts[key] !== undefined)
  if (present.length === 0) return null
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {present.map((key) => (
        <div key={key} className="flex justify-between gap-2">
          <dt className="truncate opacity-60">{labels[key]}</dt>
          <dd className="font-medium">{facts[key]}</dd>
        </div>
      ))}
    </dl>
  )
}
