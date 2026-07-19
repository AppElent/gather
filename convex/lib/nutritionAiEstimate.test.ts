import { describe, expect, test, vi } from 'vitest'
import { estimateNutritionWithAi } from './nutritionAiEstimate'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('estimateNutritionWithAi', () => {
  test('maps a successful tool_use response to sanitized NutritionFacts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: 420, protein: 18, bogus: 9, fat: -2 },
          },
        ],
      }),
    )
    const result = await estimateNutritionWithAi(
      ['200 g pasta', '100 g spek'],
      4,
      'test-key',
      fetchImpl,
    )
    expect(result).toEqual({ calories: 420, protein: 18 })
    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.messages[0].content).toContain('200 g pasta')
    expect(body.messages[0].content).toContain('4 servings')
  })

  test('says "unknown" servings when not provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: 100 },
          },
        ],
      }),
    )
    await estimateNutritionWithAi(['water'], undefined, 'test-key', fetchImpl)
    const body = JSON.parse(
      (fetchImpl.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.messages[0].content).toContain('unknown (assume 4)')
  })

  test('returns null when the model reports not found', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          { type: 'tool_use', name: 'estimate_nutrition', input: { found: false } },
        ],
      }),
    )
    expect(
      await estimateNutritionWithAi(['gravel'], 2, 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null when all values are invalid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        content: [
          {
            type: 'tool_use',
            name: 'estimate_nutrition',
            input: { found: true, calories: -1 },
          },
        ],
      }),
    )
    expect(
      await estimateNutritionWithAi(['x'], 2, 'test-key', fetchImpl),
    ).toBeNull()
  })

  test('returns null on request failure and on fetch throw', async () => {
    expect(
      await estimateNutritionWithAi(
        ['x'],
        2,
        'test-key',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await estimateNutritionWithAi(
        ['x'],
        2,
        'test-key',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
