import {
  GROCERY_AISLE_GUIDE,
  GROCERY_AISLES,
  type GroceryAisle,
  isGroceryAisle,
} from '@gather/core/groceries'
import { type AnthropicTool, callAnthropicTool, SMALL_MODEL } from './anthropic'

/**
 * The AI fallback's one question (APP-353): which aisle is this grocery
 * name in? The model sees the normalised name and nothing else — no Group,
 * no person, no other items — and can only answer with an aisle id from the
 * fixed list, because that is the tool's only input.
 */
const AISLE_TOOL: AnthropicTool = {
  name: 'choose_aisle',
  description: 'Report the supermarket aisle a grocery item is found in.',
  input_schema: {
    type: 'object',
    properties: {
      aisle: { type: 'string', enum: [...GROCERY_AISLES] },
    },
    required: ['aisle'],
  },
}

const AISLE_LIST = GROCERY_AISLES.map(
  (aisle) => `- ${aisle}: ${GROCERY_AISLE_GUIDE[aisle]}`,
).join('\n')

export function groceryAislePrompt(name: string): string {
  return [
    'Sort an item from a Dutch household shopping list into the aisle of a Dutch supermarket (Albert Heijn, Jumbo) where a shopper finds it.',
    'The item may be Dutch or English, a brand name, or misspelled. Choose "other" for anything a supermarket does not sell: services, errands and chores are "other", not products.',
    'When the item is a product, a brand goes where the thing it sells goes: cleaning and laundry brands to household. Fresh juice and smoothies go with drinks, unless clearly chilled dairy.',
    '',
    'Aisles:',
    AISLE_LIST,
    '',
    `Item: ${JSON.stringify(name)}`,
  ].join('\n')
}

/**
 * Everything that decides what the model answers: its id, the tool it must
 * call and the prompt (with a placeholder for the name). The eval snapshot
 * records a hash of this (APP-751), so a changed prompt, tool or model fails
 * the eval until `scripts/groceries/ask-ai.ts` has been run again on dev.
 */
export function groceryAiFingerprint(): string {
  return JSON.stringify({
    model: SMALL_MODEL,
    tool: AISLE_TOOL,
    prompt: groceryAislePrompt('{name}'),
  })
}

/**
 * Whether a name may be sent to the model at all. Anything that looks like
 * more than a product — an address, a phone or account number, a sentence —
 * stays in `other` rather than leave the server.
 */
export function isAskableGroceryName(name: string): boolean {
  if (name.length < 2 || name.length > 60) return false
  if (/[@/\\]|https?:|www\./i.test(name)) return false
  if (/\d{4,}/.test(name)) return false
  return name.split(/\s+/).length <= 6
}

/** The model's aisle for a name, or null for no usable answer. */
export async function askGroceryAisle(
  name: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GroceryAisle | null> {
  const input = await callAnthropicTool({
    apiKey,
    tool: AISLE_TOOL,
    maxTokens: 64,
    model: SMALL_MODEL,
    prompt: groceryAislePrompt(name),
    fetchImpl,
  })
  const aisle = input?.aisle
  return typeof aisle === 'string' && isGroceryAisle(aisle) ? aisle : null
}
