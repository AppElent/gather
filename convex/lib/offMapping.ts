import { type NutritionFacts, parseNutritionValue } from './nutrition'

export interface OffMappedFood {
  name: string
  brand?: string
  nutritionPer100: NutritionFacts
  servingSize?: number
  servingLabel?: string
}

interface OffProduct {
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

  const brand =
    typeof product.brands === 'string' && product.brands.trim()
      ? product.brands.split(',')[0].trim()
      : undefined

  return {
    name: preferredName(product),
    brand,
    nutritionPer100,
    servingSize: parseServingSize(product),
    servingLabel:
      typeof product.serving_size === 'string'
        ? product.serving_size.trim() || undefined
        : undefined,
  }
}
