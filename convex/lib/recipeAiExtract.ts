import { type AnthropicTool, callAnthropicTool } from './anthropic'
import { sanitizeNutrition } from './nutrition'
import type { ParsedRecipe } from './recipeParsing'

const EXTRACT_TOOL: AnthropicTool = {
  name: 'extract_recipe',
  description:
    'Extract recipe details from the page text, or report that none was found.',
  input_schema: {
    type: 'object',
    properties: {
      found: {
        type: 'boolean',
        description: 'Whether a recipe was found in the page text',
      },
      title: { type: 'string' },
      description: { type: 'string' },
      ingredients: { type: 'array', items: { type: 'string' } },
      steps: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
      prepMinutes: { type: 'number' },
      imageUrl: { type: 'string' },
      servings: {
        type: 'number',
        description: 'Number of servings the recipe yields',
      },
      nutrition: {
        type: 'object',
        description:
          'Nutrition per serving. calories in kcal; all other values in grams (salt as salt, not sodium). Use values stated on the page when present, otherwise estimate from the ingredients and servings.',
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          sugars: { type: 'number' },
          fat: { type: 'number' },
          saturatedFat: { type: 'number' },
          fiber: { type: 'number' },
          salt: { type: 'number' },
        },
      },
    },
    required: ['found'],
  },
}

export async function extractRecipeWithAi(
  pageText: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedRecipe | null> {
  const input = await callAnthropicTool({
    apiKey,
    tool: EXTRACT_TOOL,
    maxTokens: 4096,
    prompt: `Extract the recipe from this web page text. If there's no recipe on the page, set found to false. Report servings and per-serving nutrition: use values stated on the page when present, otherwise estimate them from the ingredients.\n\n${pageText}`,
    fetchImpl,
  })
  if (input?.found !== true) return null
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return null

  return {
    title,
    description:
      typeof input.description === 'string' ? input.description : undefined,
    ingredients: Array.isArray(input.ingredients)
      ? input.ingredients.filter((i): i is string => typeof i === 'string')
      : [],
    steps: Array.isArray(input.steps)
      ? input.steps.filter((s): s is string => typeof s === 'string')
      : [],
    tags: Array.isArray(input.tags)
      ? input.tags.filter((t): t is string => typeof t === 'string')
      : [],
    prepMinutes:
      typeof input.prepMinutes === 'number' ? input.prepMinutes : undefined,
    imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl : undefined,
    servings:
      typeof input.servings === 'number' &&
      Number.isFinite(input.servings) &&
      input.servings > 0
        ? Math.round(input.servings)
        : undefined,
    nutrition: sanitizeNutrition(input.nutrition),
  }
}
