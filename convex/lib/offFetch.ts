const OFF_USER_AGENT =
  'gather-nutrition-tracker/1.0 (https://github.com/AppElent/gather)'
const OFF_TIMEOUT_MS = 10_000
const BARCODE_PATTERN = /^\d{8,14}$/

// Fetches a product from the Open Food Facts API by barcode. Returns the
// raw parsed JSON response, or null on any failure (malformed barcode,
// network error, timeout, non-OK status, invalid JSON) — a barcode lookup
// must never throw; the caller falls back to manual entry either way
// (spec §6).
export async function fetchOffProduct(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  if (!BARCODE_PATTERN.test(barcode)) return null
  let response: Response
  try {
    response = await fetchImpl(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: { 'User-Agent': OFF_USER_AGENT },
        signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
      },
    )
  } catch {
    return null
  }
  if (!response.ok) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

// Searches Open Food Facts by free-text term (product name/brand) for the
// "no local match" fallback in FoodAddTab. Same never-throw contract as
// fetchOffProduct: returns the raw parsed JSON ({products: [...]} shape) on
// success, or null on any failure (network error, timeout, non-OK status,
// invalid JSON) — the caller treats null the same as "no matches".
export async function searchOffProducts(
  term: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search')
  url.searchParams.set('search_terms', term)
  url.searchParams.set('page_size', '20')
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_nl,brands,nutriments,serving_size,serving_quantity',
  )
  let response: Response
  try {
    response = await fetchImpl(url.toString(), {
      headers: { 'User-Agent': OFF_USER_AGENT },
      signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
    })
  } catch {
    return null
  }
  if (!response.ok) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}
