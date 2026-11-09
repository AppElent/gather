import { parseDecimal } from '@gather/core/decimal'
import {
  NUTRIENT_KEYS,
  type NutrientKey,
  type NutritionFacts,
} from '@gather/core/domain'

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
    if (value !== null && value >= 0) facts[key] = value
  }
  return facts
}
