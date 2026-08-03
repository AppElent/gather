import { type NutritionFacts, parseNutritionValue } from './nutrition'

export interface OffMappedFood {
  name: string
  brand?: string
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

export interface OffSearchResult extends OffMappedFood {
  barcode: string
}

interface OffProduct {
  code?: unknown
  product_name?: unknown
  product_name_nl?: unknown
  brands?: unknown
  nutriments?: Record<string, unknown>
  serving_size?: unknown
  serving_quantity?: unknown
}

interface OffResponse {
  status?: unknown
  product?: OffProduct
}

interface OffSearchResponse {
  hits?: unknown
}

// The v2 product-by-barcode API represents brands as a comma-joined string
// ("Ferrero,Nutella"); search-a-licious (mapOffSearchResults' source)
// represents the same field as a string array (["Nutella", " Ferrero"]).
// Handle both shapes and return the first non-empty one, trimmed.
function firstBrand(brands: unknown): string | undefined {
  if (typeof brands === 'string') {
    const first = brands.split(',')[0]?.trim()
    return first || undefined
  }
  if (Array.isArray(brands)) {
    const first = brands.find(
      (b): b is string => typeof b === 'string' && b.trim() !== '',
    )
    return first?.trim()
  }
  return undefined
}

// Open Food Facts product names are per-product, not per-request-locale — a
// Dutch name lives in `product_name_nl` alongside the (often differently
// worded, or same-language-by-coincidence) `product_name`. Prefer Dutch since
// this app's users primarily scan Dutch supermarket products; fall back to
// the generic name, then to an empty string the user fills in on the
// confirmation screen (spec §4.3).
function preferredName(product: OffProduct): string {
  const nl = product.product_name_nl
  if (typeof nl === 'string' && nl.trim()) return nl.trim()
  const generic = product.product_name
  if (typeof generic === 'string' && generic.trim()) return generic.trim()
  return ''
}

function parseServingSize(product: OffProduct): number | undefined {
  if (
    typeof product.serving_quantity === 'number' &&
    Number.isFinite(product.serving_quantity) &&
    product.serving_quantity > 0
  ) {
    return product.serving_quantity
  }
  if (typeof product.serving_size === 'string') {
    const match = /^(\d+(?:[.,]\d+)?)/.exec(product.serving_size.trim())
    if (match) {
      const value = Number(match[1].replace(',', '.'))
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return undefined
}

const NUTRIMENT_MAPPINGS: Array<[keyof NutritionFacts, string]> = [
  ['calories', 'energy-kcal_100g'],
  ['protein', 'proteins_100g'],
  ['carbs', 'carbohydrates_100g'],
  ['sugars', 'sugars_100g'],
  ['fat', 'fat_100g'],
  ['saturatedFat', 'saturated-fat_100g'],
  ['fiber', 'fiber_100g'],
  ['salt', 'salt_100g'],
]

// Maps one OFF product object (from either the single-product or search
// response shapes) to our foods shape. Always returns a mapped object, even
// when the name is empty — the barcode single-product path (mapOffProduct)
// leaves that decision to the user on the confirmation screen (spec §4.3);
// the search path (mapOffSearchResults) applies its own empty-name filter
// on top of this, since a nameless row is just noise in a results list.
function mapOffRawProduct(product: OffProduct): OffMappedFood {
  const nutriments = product.nutriments
  const nutritionPer100: NutritionFacts = {}
  if (typeof nutriments === 'object' && nutriments !== null) {
    for (const [key, offField] of NUTRIMENT_MAPPINGS) {
      // OFF's *_100g fields are already plain numbers in the right unit
      // (kcal for energy, grams for everything else) — parseNutritionValue's
      // number branch just validates finiteness/non-negativity here, no
      // unit conversion is triggered (that only fires on strings containing
      // "mg"/"kJ", which these fields never are).
      const parsed = parseNutritionValue(nutriments[offField])
      if (parsed !== undefined) nutritionPer100[key] = parsed
    }
  }

  return {
    name: preferredName(product),
    brand: firstBrand(product.brands),
    nutritionPer100,
    servingSize: parseServingSize(product),
    servingLabel:
      typeof product.serving_size === 'string'
        ? product.serving_size.trim() || undefined
        : undefined,
  }
}

// Maps a raw Open Food Facts /api/v2/product/{barcode} response to our foods
// shape. Returns null when the product wasn't found (status !== 1) or the
// response is malformed — barcode lookups must never throw; the caller falls
// back to manual entry either way (spec §6).
export function mapOffProduct(raw: unknown): OffMappedFood | null {
  if (typeof raw !== 'object' || raw === null) return null
  const response = raw as OffResponse
  if (response.status !== 1) return null
  const product = response.product
  if (typeof product !== 'object' || product === null) return null
  return mapOffRawProduct(product)
}

// OFF's product database has many low-quality/duplicate barcodes for the
// same real product (community-contributed, no dedup enforced) — a search
// for "nutella" can return a dozen "Nutella" hits, several with no
// nutrition data at all. Used both to drop unusable entries and, via
// nutrientCount, to pick the best of several same-name/brand duplicates.
function nutrientCount(nutritionPer100: NutritionFacts): number {
  return Object.keys(nutritionPer100).length
}

// Maps a raw search-a-licious /search response ({hits: [...]}) to a capped,
// deduplicated list of importable results. Unlike mapOffProduct, this drops
// entries with no usable name (noise in a results list, spec §4.3 of the
// 2026-07-20 OFF name-search design), no barcode (unusable — the result
// can't be upserted without one), or no nutrition data at all (useless for
// a nutrition tracker, and OFF has plenty of near-empty duplicate barcodes
// for popular products). Remaining entries are deduplicated by normalized
// name+brand, keeping whichever duplicate has the most nutrients populated
// — search relevance order is otherwise preserved. Malformed/non-object
// input, or a missing `hits` array, returns an empty list — search is a
// soft fallback, never throws.
export function mapOffSearchResults(raw: unknown): OffSearchResult[] {
  if (typeof raw !== 'object' || raw === null) return []
  const response = raw as OffSearchResponse
  if (!Array.isArray(response.hits)) return []

  const byDedupKey = new Map<string, OffSearchResult>()
  for (const entry of response.hits) {
    if (typeof entry !== 'object' || entry === null) continue
    const product = entry as OffProduct
    const barcode =
      typeof product.code === 'string' ? product.code.trim() : ''
    if (!barcode) continue
    const mapped = mapOffRawProduct(product)
    if (!mapped.name) continue
    if (nutrientCount(mapped.nutritionPer100) === 0) continue

    const dedupKey = `${mapped.name.toLowerCase()}|${(mapped.brand ?? '').toLowerCase()}`
    const existing = byDedupKey.get(dedupKey)
    if (
      !existing ||
      nutrientCount(mapped.nutritionPer100) >
        nutrientCount(existing.nutritionPer100)
    ) {
      byDedupKey.set(dedupKey, { ...mapped, barcode })
    }
  }
  return Array.from(byDedupKey.values()).slice(0, 20)
}
