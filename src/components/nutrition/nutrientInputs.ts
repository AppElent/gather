import {
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutritionFacts,
} from '../../../convex/lib/nutrition'

export const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60'

// Accepts Dutch decimal commas ("12,5"); empty/invalid/negative → undefined.
export const parseDecimal = (s: string): number | undefined => {
  if (!s.trim()) return undefined
  const n = Number(s.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const toNutrientInputs = (
  facts?: NutritionFacts,
): Record<NutrientKey, string> =>
  Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [
      k,
      facts?.[k] !== undefined ? String(facts[k]) : '',
    ]),
  ) as Record<NutrientKey, string>

export const nutrientInputsToFacts = (
  inputs: Record<NutrientKey, string>,
): NutritionFacts => {
  const facts: NutritionFacts = {}
  for (const key of NUTRIENT_KEYS) {
    const value = parseDecimal(inputs[key])
    if (value !== undefined) facts[key] = value
  }
  return facts
}
