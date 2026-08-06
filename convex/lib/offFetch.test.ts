import { describe, expect, test, vi } from 'vitest'
import { fetchOffProduct, searchOffProducts } from './offFetch'

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

describe('searchOffProducts', () => {
  test('fetches the search-a-licious endpoint with the term, language, page size, and field list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ hits: [] }))
    await searchOffProducts('nutella', 'en', fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://search.openfoodfacts.org/search?q=nutella&langs=en&page_size=40&fields=code%2Cproduct_name%2Cproduct_name_nl%2Cbrands%2Cnutriments%2Cserving_size%2Cserving_quantity%2Cimage_front_small_url%2Cimage_small_url%2Cimage_url',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    )
  })

  test('searches in the language it was given, not the service default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ hits: [] }))
    await searchOffProducts('hagelslag', 'nl', fetchImpl)
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('langs')).toBe(
      'nl',
    )
  })

  test('falls back to English when no usable language is given', async () => {
    for (const locale of [undefined, '', 'not-a-language', '🇳🇱']) {
      const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ hits: [] }))
      await searchOffProducts('brie', locale, fetchImpl)
      expect(
        new URL(fetchImpl.mock.calls[0][0]).searchParams.get('langs'),
      ).toBe('en')
    }
  })

  test('takes the base language of a regional locale', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ hits: [] }))
    await searchOffProducts('brie', 'nl-NL', fetchImpl)
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('langs')).toBe(
      'nl',
    )
  })

  test('returns the parsed JSON on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ hits: [{ code: '123', product_name: 'Test' }] }),
      )
    expect(await searchOffProducts('test', 'en', fetchImpl)).toEqual({
      hits: [{ code: '123', product_name: 'Test' }],
    })
  })

  test('returns null on a non-ok response, a JSON parse failure, and a fetch throw', async () => {
    expect(
      await searchOffProducts(
        'test',
        'en',
        vi.fn().mockResolvedValue(mockResponse({}, false)),
      ),
    ).toBeNull()
    expect(
      await searchOffProducts(
        'test',
        'en',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('bad json')
          },
        } as unknown as Response),
      ),
    ).toBeNull()
    expect(
      await searchOffProducts(
        'test',
        'en',
        vi.fn().mockRejectedValue(new Error('network down')),
      ),
    ).toBeNull()
  })
})
