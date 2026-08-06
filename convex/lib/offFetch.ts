const OFF_USER_AGENT =
  'gather-nutrition-tracker/1.0 (https://github.com/AppElent/gather)'
const OFF_TIMEOUT_MS = 10_000
const BARCODE_PATTERN = /^\d{8,14}$/
const LANG_PATTERN = /^[a-z]{2}$/

/**
 * The language subfields search-a-licious should look in.
 *
 * The locale arrives from the client, so it is whatever a caller sent rather
 * than one of gather's two locales — a regional tag (`nl-NL`), something
 * unrecognised, or nothing at all. Take the base language when there is one
 * and fall back to English, which is what the service does anyway when the
 * parameter is missing.
 */
export function normalizeSearchLang(locale?: string): string {
  const base = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? ''
  return LANG_PATTERN.test(base) ? base : 'en'
}

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

// Searches Open Food Facts by free-text term (product name/brand), run
// alongside the local food search. Full-text search is NOT part of
// the world.openfoodfacts.org/api/v2 REST API — that API is structured/tag
// search only and silently ignores an unrecognized `search_terms` param
// (returning an unfiltered, identical-every-time page of the whole catalog
// rather than an error, which is what shipped here originally). The actual
// full-text search service is "search-a-licious" at search.openfoodfacts.org,
// a separate host with its own response shape ({hits: [...]}, see
// mapOffSearchResults) and `q` query param instead of `search_terms`. Same
// never-throw contract as fetchOffProduct: returns the raw parsed JSON on
// success, or null on any failure (network error, timeout, non-OK status,
// invalid JSON) — the caller treats null the same as "no matches".
export async function searchOffProducts(
  term: string,
  lang?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const url = new URL('https://search.openfoodfacts.org/search')
  url.searchParams.set('q', term)
  // Which language's name subfields are searched. search-a-licious defaults
  // to English when this is absent, which is what gather did for as long as
  // it has preferred Dutch names on the way *back* — it searched English and
  // displayed Dutch, so a Dutch product name found nothing.
  url.searchParams.set('langs', normalizeSearchLang(lang))
  // Requesting more than the ~20 we ultimately show: mapOffSearchResults
  // drops empty-nutrition duplicates and dedupes same-name/brand hits (OFF
  // has many low-quality duplicate barcodes for popular products), so a
  // 1:1 page size would often leave far fewer than 20 usable results.
  url.searchParams.set('page_size', '40')
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_nl,brands,nutriments,serving_size,serving_quantity,image_front_small_url,image_small_url,image_url',
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
