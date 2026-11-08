import type {
  NutrientKey,
  NutritionFacts,
  NutritionSource,
} from '@gather/core/domain'
import { useState } from 'react'
import { hasNutritionFigures } from '../../../convex/lib/nutrition'
import { nutrientInputsToFacts, toNutrientInputs } from './nutrientInputs'

/**
 * The nutrient figures a food or recipe form is editing, and where they came
 * from.
 *
 * The source is a fact about the figures on screen: typing over one makes
 * them `manual`, filling them from somewhere sets that somewhere, and with no
 * figures at all there is nothing to say about where they came from. What the
 * form shows and what a save sends are read off the same figures, so the two
 * cannot disagree.
 */
export function useNutritionInputs(
  initial?: NutritionFacts,
  initialSource?: NutritionSource,
) {
  const [inputs, setInputs] = useState(() => toNutrientInputs(initial))
  const [source, setSource] = useState(initialSource)
  const facts = nutrientInputsToFacts(inputs)
  const hasFigures = hasNutritionFigures(facts)

  return {
    inputs,
    facts,
    hasFigures,
    shownSource: hasFigures ? source : undefined,
    /** A save of figures nobody said the origin of is somebody typing them. */
    savedSource: hasFigures ? (source ?? 'manual') : undefined,
    type: (key: NutrientKey, value: string) => {
      setInputs((prev) => ({ ...prev, [key]: value }))
      setSource('manual')
    },
    fill: (next: NutritionFacts, from: NutritionSource) => {
      setInputs(toNutrientInputs(next))
      setSource(from)
    },
  }
}
