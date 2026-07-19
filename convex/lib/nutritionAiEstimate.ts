import { type NutritionFacts, sanitizeNutrition } from './nutrition'

const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_MAX_TOKENS = 1024
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const ESTIMATE_TOOL = {
  name: 'estimate_nutrition',
  description:
    'Report estimated per-serving nutrition for a recipe, or that estimation is impossible.',
  input_schema: {
    type: 'object' as const,
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

interface AnthropicToolUseBlock {
  type: 'tool_use'
  name: string
  input: Record<string, unknown>
}

interface AnthropicMessagesResponse {
  content: Array<Record<string, unknown>>
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
  let response: Response
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        tools: [ESTIMATE_TOOL],
        tool_choice: { type: 'tool', name: 'estimate_nutrition' },
        messages: [
          {
            role: 'user',
            content: `Estimate the nutrition per serving for this recipe. Ingredient lines may be in Dutch or English. Servings: ${servingsText}.\n\nIngredients:\n${ingredients.join('\n')}`,
          },
        ],
      }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  let data: AnthropicMessagesResponse
  try {
    data = (await response.json()) as AnthropicMessagesResponse
  } catch {
    return null
  }
  if (!Array.isArray(data.content)) return null

  const rawToolUseBlock = data.content.find(
    (block) =>
      block.type === 'tool_use' &&
      block.name === 'estimate_nutrition' &&
      typeof block.input === 'object' &&
      block.input !== null,
  )
  if (!rawToolUseBlock) return null
  const toolUseBlock = rawToolUseBlock as unknown as AnthropicToolUseBlock
  if (toolUseBlock.input.found !== true) return null
  return sanitizeNutrition(toolUseBlock.input) ?? null
}
