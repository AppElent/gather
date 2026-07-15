import type { ParsedRecipe } from './recipeParsing'

const ANTHROPIC_MODEL = 'claude-sonnet-5'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const EXTRACT_TOOL = {
  name: 'extract_recipe',
  description:
    'Extract recipe details from the page text, or report that none was found.',
  input_schema: {
    type: 'object' as const,
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

export async function extractRecipeWithAi(
  pageText: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedRecipe | null> {
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
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_recipe' },
        messages: [
          {
            role: 'user',
            content: `Extract the recipe from this web page text. If there's no recipe on the page, set found to false.\n\n${pageText}`,
          },
        ],
      }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const data = (await response.json()) as AnthropicMessagesResponse
  const toolUseBlock = data.content.find(
    (block) => block.type === 'tool_use' && block.name === 'extract_recipe',
  )
  if (!toolUseBlock) return null
  const toolUse = toolUseBlock as unknown as AnthropicToolUseBlock

  const input = toolUse.input
  if (input.found !== true) return null
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
  }
}
