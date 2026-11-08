const MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: { type: 'object' } & Record<string, unknown>
}

export function anthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY
}

/**
 * Ask the model to answer by calling one tool, and return what it passed.
 *
 * Null for every way of not getting an answer (network, a refused call, a body
 * that does not parse, the tool not being used): the features built on this are
 * best effort, and each says for itself what no answer means.
 */
export async function callAnthropicTool({
  apiKey,
  tool,
  maxTokens,
  prompt,
  fetchImpl = fetch,
}: {
  apiKey: string
  tool: AnthropicTool
  maxTokens: number
  prompt: string
  fetchImpl?: typeof fetch
}): Promise<Record<string, unknown> | null> {
  let data: { content?: Array<Record<string, unknown>> }
  try {
    const response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) return null
    data = await response.json()
  } catch {
    return null
  }
  if (!Array.isArray(data.content)) return null

  const block = data.content.find(
    (candidate) =>
      candidate.type === 'tool_use' &&
      candidate.name === tool.name &&
      typeof candidate.input === 'object' &&
      candidate.input !== null,
  )
  return block ? (block.input as Record<string, unknown>) : null
}
