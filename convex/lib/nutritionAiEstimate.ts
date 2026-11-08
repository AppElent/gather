import type { NutritionFacts } from '@gather/core/domain'
import { type AnthropicTool, callAnthropicTool } from './anthropic'
import { sanitizeNutrition } from './nutrition'

const ESTIMATE_TOOL: AnthropicTool = {
  name: 'estimate_nutrition',
  description:
    'Report estimated per-serving nutrition for a recipe, or that estimation is impossible.',
  input_schema: {
    type: 'object',
    properties: {
      found: {
        type: 'boolean',
        description:
          'False when the ingredients are not food or nutrition cannot be estimated',
      },
      calories: { type: 'number', description: 'kcal per serving' },
      protein: { type: 'number', description: 'grams per serving' },
      carbs: { type: 'number', description: 'grams per serving' },
      sugars: { type: 'number', description: 'grams per serving' },
      fat: { type: 'number', description: 'grams per serving' },
      saturatedFat: { type: 'number', description: 'grams per serving' },
      fiber: { type: 'number', description: 'grams per serving' },
      salt: {
        type: 'number',
        description: 'grams of salt (not sodium) per serving',
      },
    },
    required: ['found'],
  },
}

// The single "text → nutrition" seam (spec §4.2): a future NEVO or other
// lookup backend replaces this function's internals without touching
// callers, schema, or UI.
export async function estimateNutritionWithAi(
  ingredients: string[],
  servings: number | undefined,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NutritionFacts | null> {
  const servingsText = servings ? `${servings} servings` : 'unknown (assume 4)'
  const input = await callAnthropicTool({
    apiKey,
    tool: ESTIMATE_TOOL,
    maxTokens: 1024,
    prompt: `Estimate the nutrition per serving for this recipe. Ingredient lines may be in Dutch or English. Servings: ${servingsText}.\n\nIngredients:\n${ingredients.join('\n')}`,
    fetchImpl,
  })
  if (input?.found !== true) return null
  return sanitizeNutrition(input) ?? null
}
