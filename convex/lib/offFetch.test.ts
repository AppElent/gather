import { describe, expect, test, vi } from 'vitest'
import { fetchOffProduct } from './offFetch'

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

describe('fetchOffProduct', () => {
  test('rejects barcodes that are not 8-14 digits without making a request', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchOffProduct('abc', fetchImpl)).toBeNull()
    expect(await fetchOffProduct('123', fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('fetches the correct URL with a User-Agent header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 1 }))
    await fetchOffProduct('3017620422003', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v2/product/3017620422003.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    )
  })

  test('returns the parsed JSON on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({ status: 1, product: { product_name: 'Test' } }),
    )
    expect(await fetchOffProduct('3017620422003', fetchImpl)).toEqual({
      status: 1,
      product: { product_name: 'Test' },
    })
  })

  test('returns null on a non-ok response, a JSON parse failure, and a fetch throw', async () => {
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('bad json')
          },
        } as unknown as Response),
      ),
    ).toBeNull()
    expect(
      await fetchOffProduct(
        '3017620422003',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
