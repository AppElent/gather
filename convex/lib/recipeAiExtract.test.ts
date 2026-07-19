import { describe, expect, test, vi } from 'vitest'
import { extractRecipeWithAi } from './recipeAiExtract'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('extractRecipeWithAi', () => {
  test('maps a successful tool_use response to a ParsedRecipe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: {
              found: true,
              title: 'Weeknight Tacos',
              ingredients: ['tortillas', 'beef'],
              steps: ['Cook beef.', 'Fill tortillas.'],
              tags: ['dinner'],
              prepMinutes: 15,
            },
          },
        ],
      }),
    )

    const result = await extractRecipeWithAi(
      'some page text',
      'test-key',
      fetchImpl,
    )

    expect(result).toEqual({
      title: 'Weeknight Tacos',
      description: undefined,
      ingredients: ['tortillas', 'beef'],
      steps: ['Cook beef.', 'Fill tortillas.'],
      tags: ['dinner'],
      prepMinutes: 15,
      imageUrl: undefined,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      }),
    )
  })

  test('returns null when the model reports no recipe found', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          { type: 'tool_use', name: 'extract_recipe', input: { found: false } },
        ],
      }),
    )
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null (not throws) for a malformed-but-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          { type: 'tool_use', name: 'extract_recipe' /* no `input` field */ },
        ],
      }),
    )
    await expect(
      extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).resolves.toBeNull()
  })

  test('returns null when the request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({}, false))
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    expect(
      await extractRecipeWithAi('some page text', 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('maps servings and sanitized nutrition from the tool response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: {
              found: true,
              title: 'Erwtensoep',
              ingredients: ['spliterwten'],
              steps: ['Kook.'],
              servings: 6,
              nutrition: { calories: 400, protein: 22, bogus: 1, fat: -3 },
            },
          },
        ],
      }),
    )
    const result = await extractRecipeWithAi('page', 'test-key', fetchImpl)
    expect(result?.servings).toBe(6)
    expect(result?.nutrition).toEqual({ calories: 400, protein: 22 })
  })

  test('omits servings and nutrition when absent from the tool response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'extract_recipe',
            input: { found: true, title: 'Toast', ingredients: ['bread'], steps: ['Toast.'] },
          },
        ],
      }),
    )
    const result = await extractRecipeWithAi('page', 'test-key', fetchImpl)
    expect(result?.servings).toBeUndefined()
    expect(result?.nutrition).toBeUndefined()
  })
})
