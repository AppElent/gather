import {
  capitalise,
  GROCERY_UNITS,
  type GroceryUnit,
  isGroceryQuantity,
  isGroceryUnit,
  roundGroceryQuantity,
} from '@gather/core/groceries'
import { type AnthropicTool, callAnthropicTool, SMALL_MODEL } from './anthropic'

/** At most this many lines go in one question; the rest stay plain text. */
export const AI_LINES_MAX = 40
/** A line longer than this is cut before it is asked about. */
export const AI_LINE_LENGTH_MAX = 200

const READ_TOOL: AnthropicTool = {
  name: 'read_grocery_lines',
  description:
    'Report, for each numbered recipe ingredient line, the product to buy and how much of it.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: {
              type: 'number',
              description: 'The number of the line this answers',
            },
            name: {
              type: 'string',
              description:
                'The product as a shopper would write it on a list, in the language of the line, without amount or preparation',
            },
            quantity: {
              type: 'number',
              description: 'How much, in the unit; leave out when the line names no amount',
            },
            unit: {
              type: 'string',
              enum: [...GROCERY_UNITS],
              description:
                'The unit of the quantity; leave out for a count of things',
            },
          },
          required: ['index', 'name'],
        },
      },
    },
    required: ['items'],
  },
}

/** What the AI made of one line. */
export interface AiReadLine {
  name: string
  quantity?: number
  unit?: GroceryUnit
}

/**
 * Ask a small model what each line is to buy. One answer per line, by its
 * position: a line the model skipped or answered with nothing usable is null
 * there, and the phone adds it as plain text. Null for no answer at all.
 */
export async function readGroceryLinesWithAi(
  lines: readonly string[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<(AiReadLine | null)[] | null> {
  const numbered = lines
    .map((line, index) => `${index + 1}. ${line.slice(0, AI_LINE_LENGTH_MAX)}`)
    .join('\n')
  const input = await callAnthropicTool({
    apiKey,
    model: SMALL_MODEL,
    tool: READ_TOOL,
    maxTokens: 2048,
    prompt: `These are ingredient lines from a recipe, in Dutch or English. For each line, say what to put on a grocery list: the product, and the amount with one of the given units when the line names one. Convert a measure that is not a unit (a cup, a handful) to grams, millilitres or a count when that is meaningful, otherwise leave the amount out. "Juice of 1 lemon" is 1 lemon.\n\n${numbered}`,
    fetchImpl,
  })
  if (!input || !Array.isArray(input.items)) return null
  const read: (AiReadLine | null)[] = lines.map(() => null)
  for (const item of input.items) {
    if (typeof item !== 'object' || item === null) continue
    const { index, name, quantity, unit } = item as Record<string, unknown>
    if (typeof index !== 'number' || !Number.isInteger(index)) continue
    if (index < 1 || index > lines.length) continue
    if (typeof name !== 'string') continue
    const trimmed = name.trim().slice(0, AI_LINE_LENGTH_MAX)
    if (!trimmed) continue
    const amount =
      typeof quantity === 'number' && isGroceryQuantity(quantity)
        ? roundGroceryQuantity(quantity)
        : undefined
    read[index - 1] = {
      name: capitalise(trimmed),
      ...(amount !== undefined ? { quantity: amount } : {}),
      // A unit without its number would read as one of it; keep both or neither.
      ...(amount !== undefined && isGroceryUnit(unit) ? { unit } : {}),
    }
  }
  return read
}
