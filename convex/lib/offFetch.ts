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
